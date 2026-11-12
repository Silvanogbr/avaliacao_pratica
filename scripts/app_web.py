from datetime import datetime
from pathlib import Path
from threading import Lock
from uuid import uuid4
import base64

import cv2
import numpy as np
import joblib
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
MAX_IMAGE_BYTES = 10 * 1024 * 1024
JOBS = {}
JOBS_LOCK = Lock()

app = FastAPI(title="Demo de Inspecao Industrial", version="1.0.0")
app.mount("/assets", StaticFiles(directory=WEB), name="assets")

try:
    CLASSIFIER = joblib.load(ROOT / "modelos" / "classificador_falhas.joblib")
    ANOMALY = joblib.load(ROOT / "modelos" / "detector_anomalias.joblib")
except FileNotFoundError:
    CLASSIFIER = None
    ANOMALY = None


@app.get("/", response_class=FileResponse)
def home():
    return FileResponse(WEB / "index.html")


@app.get("/health")
def health():
    loaded = CLASSIFIER is not None and ANOMALY is not None
    return {"status": "ok", "modelos_carregados": loaded}


def run_inference(job_id, payload):
    try:
        features = CLASSIFIER["features"]
        values = payload["dados"]
        row = pd.DataFrame([{name: values[name] for name in features}])
        model = CLASSIFIER["modelo"]
        anomaly_model = ANOMALY["modelo"]
        label = model.predict(row)[0]
        confidence = float(model.predict_proba(row).max())
        score = float(-anomaly_model.score_samples(row)[0])
        is_anomaly = score >= ANOMALY["limiar"]

        if confidence < 0.70:
            action = "Encaminhar para revisao humana"
        elif label == "Sem Falha" and not is_anomaly:
            action = "Registrar e continuar monitoramento"
        else:
            action = "Alertar operador para inspecao; sem comando automatico"

        result = {
            "id": job_id,
            "status": "concluida",
            "classe": str(label),
            "confianca": round(confidence, 3),
            "anomalia": bool(is_anomaly),
            "escore_anomalia": round(score, 4),
            "acao_sugerida": action,
            "revisao_humana": True,
            "lote_id": payload["lote_id"],
        }
        with JOBS_LOCK:
            JOBS[job_id] = result
    except Exception as error:
        with JOBS_LOCK:
            JOBS[job_id] = {"id": job_id, "status": "erro", "detalhe": str(error)}


@app.post("/api/inferencias", status_code=202)
def create_inference(payload: dict, background_tasks: BackgroundTasks):
    if CLASSIFIER is None or ANOMALY is None:
        raise HTTPException(503, "Execute scripts/modelagem.py para gerar os modelos.")
    if payload.get("tipo") != "tabular":
        raise HTTPException(400, "Este endpoint aceita tipo=tabular.")
    if not payload.get("lote_id"):
        raise HTTPException(400, "Informe lote_id.")
    try:
        datetime.fromisoformat(payload["timestamp"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(400, "timestamp deve usar o formato ISO-8601.")

    values = payload.get("dados")
    features = CLASSIFIER["features"]
    if not isinstance(values, dict):
        raise HTTPException(400, "dados deve ser um objeto JSON.")
    missing = [name for name in features if name not in values]
    if missing:
        raise HTTPException(400, "Features faltando: " + ", ".join(missing))
    if not all(isinstance(values[name], (int, float)) for name in features):
        raise HTTPException(400, "Todas as features devem ser numericas.")

    job_id = str(uuid4())
    with JOBS_LOCK:
        JOBS[job_id] = {"id": job_id, "status": "processando"}
    background_tasks.add_task(run_inference, job_id, payload)
    return JOBS[job_id]


@app.get("/api/inferencias/{job_id}")
def get_inference(job_id: str):
    with JOBS_LOCK:
        result = JOBS.get(job_id)
    if result is None:
        raise HTTPException(404, "Inferencia nao encontrada.")
    return result


@app.post("/api/visao")
async def inspect_image(file: UploadFile = File(...)):
    raw = await file.read(MAX_IMAGE_BYTES + 1)
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Limite de imagem: 10 MB.")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "O arquivo nao pode ser lido como imagem.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Candidatos escuros e aproximadamente arredondados, compatíveis com poros.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    dark_spots = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
    _, porosity_mask = cv2.threshold(
        dark_spots, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    contours, _ = cv2.findContours(
        porosity_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    scale = (image.shape[0] * image.shape[1]) / (960 * 640)
    candidates = []
    for contour in contours:
        area = cv2.contourArea(contour)
        perimeter = cv2.arcLength(contour, True)
        if perimeter == 0 or not max(5, 8 * scale) <= area <= max(100, 700 * scale):
            continue
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        x, y, width, height = cv2.boundingRect(contour)
        aspect = width / max(height, 1)
        if circularity < 0.20 or not 0.30 < aspect < 3.0:
            continue
        candidates.append({
            "x": int(x), "y": int(y), "largura": int(width),
            "altura": int(height), "area_px": round(float(area), 1),
            "circularidade": round(float(circularity), 2),
        })

    porosity_overlay = image.copy()
    for region in candidates:
        x, y = region["x"], region["y"]
        width, height = region["largura"], region["altura"]
        cv2.rectangle(porosity_overlay, (x, y), (x + width, y + height), (0, 0, 255), 2)

    # Coloração de calor é somente um sinal visual relativo em foto RGB.
    # Uma foto comum não fornece temperatura calibrada nem mapa radiométrico.
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hue, saturation, value = cv2.split(hsv)
    warm_colors = ((hue <= 35) | (hue >= 170)) & (saturation >= 70) & (value >= 80)
    cool_heat_tint = (hue >= 85) & (hue <= 140) & (saturation >= 70) & (value >= 60)
    heat_mask = np.where(warm_colors | cool_heat_tint, 255, 0).astype(np.uint8)
    heat_mask = cv2.morphologyEx(
        heat_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)
    )
    heat_mask = cv2.morphologyEx(
        heat_mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)
    )
    heat_overlay = image.copy()
    tint = np.zeros_like(image)
    tint[:] = (0, 150, 255)
    colored = cv2.addWeighted(image, 0.48, tint, 0.52, 0)
    heat_overlay[heat_mask > 0] = colored[heat_mask > 0]
    heat_contours, _ = cv2.findContours(
        heat_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    heat_regions = [c for c in heat_contours if cv2.contourArea(c) >= max(20, 80 * scale)]
    cv2.drawContours(heat_overlay, heat_regions, -1, (0, 235, 255), 2)

    def encode_image(overlay):
        ok, encoded = cv2.imencode(".png", overlay)
        if not ok:
            raise HTTPException(500, "Falha ao gerar a visualizacao.")
        return base64.b64encode(encoded.tobytes()).decode("ascii")

    heat_area_pct = 100 * cv2.countNonZero(heat_mask) / heat_mask.size

    return {
        "nome_arquivo": file.filename,
        "resumo": {
            "largura": int(image.shape[1]),
            "altura": int(image.shape[0]),
            "brilho_medio": round(float(gray.mean()), 2),
            "contraste": round(float(gray.std()), 2),
        },
        "porosidade": {
            "candidatos_visuais": len(candidates),
            "regioes": candidates[:200],
            "resultado": "Candidatos visuais; confirme por inspeção humana.",
        },
        "termica_visual": {
            "regioes_coloridas": len(heat_regions),
            "area_colorida_pct": round(float(heat_area_pct), 2),
            "resultado": "Indicador visual de cor; não mede temperatura nem confirma HAZ.",
        },
        "overlay_porosidade_base64": encode_image(porosity_overlay),
        "overlay_termica_base64": encode_image(heat_overlay),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
