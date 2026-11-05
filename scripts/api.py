from datetime import datetime

FEATURES = [
    "temperatura_solda_c", "corrente_solda_a", "tensao_solda_v",
    "pressao_gas_bar", "vibracao_mm_s", "velocidade_linha_m_min",
    "area_porosidade_px", "temperatura_max_haz_c",
]


def validar_payload(payload):
    erros = []

    if payload.get("tipo") not in ["tabular", "imagem"]:
        erros.append("tipo deve ser tabular ou imagem")
    if not payload.get("lote_id"):
        erros.append("lote_id is required")

    try:
        datetime.fromisoformat(payload["timestamp"])
    except (KeyError, ValueError, TypeError):
        erros.append("timestamp must use ISO-8601 format")

    if payload.get("tipo") == "tabular":
        dados = payload.get("dados", {})
        faltando = [nome for nome in FEATURES if nome not in dados]
        if faltando:
            erros.append("missing features: " + ", ".join(faltando))
        elif not all(isinstance(dados[nome], (int, float)) for nome in FEATURES):
            erros.append("all features must be numeric")

    if payload.get("tipo") == "imagem" and not payload.get("imagem_uri"):
        erros.append("imagem_uri is required for image inference")

    return erros


if __name__ == "__main__":
    exemplo = {
        "tipo": "tabular",
        "timestamp": "2026-10-11T15:59:00-03:00",
        "lote_id": "LOTE_0150",
        "dados": {
            "temperatura_solda_c": 216.8,
            "corrente_solda_a": 160.2,
            "tensao_solda_v": 23.7,
            "pressao_gas_bar": 4.5,
            "vibracao_mm_s": 1.2,
            "velocidade_linha_m_min": 12.0,
            "area_porosidade_px": 7.6,
            "temperatura_max_haz_c": 227.7,
        },
        "imagem_uri": None,
    }
    print("Valid payload" if not validar_payload(exemplo) else validar_payload(exemplo))
