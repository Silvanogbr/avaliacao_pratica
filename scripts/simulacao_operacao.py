"""Simula inferência e decisão consultiva; não comanda equipamento."""
from pathlib import Path
import pandas as pd
import joblib

raiz = Path(__file__).resolve().parent.parent
modelo_path = raiz / "modelos" / "classificador_falhas.joblib"
dados_path = raiz / "dados" / "dados_tratados.csv"
if not dados_path.exists():
    dados_path = raiz / "dados" / "dataset_industrial_cibersistemas_15k.csv"
if not modelo_path.exists():
    raise FileNotFoundError("Execute scripts/modelagem.py primeiro para criar os modelos.")

pacote = joblib.load(modelo_path)
modelo, features = pacote["modelo"], pacote["features"]
dados = pd.read_csv(dados_path)

def inferir(linha):
    entrada = linha[features].to_frame().T
    classe = modelo.predict(entrada)[0]
    confianca = float(modelo.predict_proba(entrada).max())
    if confianca < 0.70:
        acao = "encaminhar para inspeção humana"
    elif classe == "Sem Falha":
        acao = "registrar e continuar monitoramento"
    else:
        acao = "alertar operador para inspeção; sem comando automático"
    return {"classe": classe, "confianca": round(confianca, 2), "acao": acao}

for _, linha in dados.tail(5).iterrows():
    print(linha.get("timestamp"), linha.get("lote_id"), inferir(linha))
