"""Treina o classificador multiclasse e o detector de anomalias."""
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import classification_report, balanced_accuracy_score, f1_score, roc_auc_score

raiz = Path(__file__).resolve().parent.parent
arquivo = raiz / "dados" / "dados_tratados.csv"
if not arquivo.exists():
    arquivo = raiz / "dados" / "dataset_industrial_cibersistemas_15k.csv"
dados = pd.read_csv(arquivo, parse_dates=["timestamp"]).sort_values("timestamp")
features = ["temperatura_solda_c", "corrente_solda_a", "tensao_solda_v",
            "pressao_gas_bar", "vibracao_mm_s", "velocidade_linha_m_min",
            "area_porosidade_px", "temperatura_max_haz_c"]
corte = int(len(dados) * 0.8)
treino, teste = dados.iloc[:corte], dados.iloc[corte:]
X_treino, y_treino = treino[features], treino.classe_falha
X_teste, y_teste = teste[features], teste.classe_falha

modelo_falhas = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42)
modelo_falhas.fit(X_treino, y_treino)
predicao = modelo_falhas.predict(X_teste)
print("Acurácia balanceada:", round(balanced_accuracy_score(y_teste, predicao), 3))
print(classification_report(y_teste, predicao, zero_division=0))

# Treina o detector apenas com exemplos normais.
X_normal = treino.loc[treino.anomalia_isolamento == 0, features]
modelo_anomalia = IsolationForest(contamination="auto", random_state=42)
modelo_anomalia.fit(X_normal)
limiar = float(np.quantile(-modelo_anomalia.score_samples(X_normal), 0.95))
escores = -modelo_anomalia.score_samples(X_teste)
alertas = (escores >= limiar).astype(int)
if teste.anomalia_isolamento.nunique() == 2:
    print("ROC AUC anomalia:", round(roc_auc_score(teste.anomalia_isolamento, escores), 3))
print("F1 anomalia:", round(f1_score(teste.anomalia_isolamento, alertas, zero_division=0), 3))

pasta_modelos = raiz / "modelos"
pasta_modelos.mkdir(exist_ok=True)
joblib.dump({"modelo": modelo_falhas, "features": features}, pasta_modelos / "classificador_falhas.joblib")
joblib.dump({"modelo": modelo_anomalia, "features": features, "limiar": limiar}, pasta_modelos / "detector_anomalias.joblib")
print("Modelos salvos na pasta modelos/")
