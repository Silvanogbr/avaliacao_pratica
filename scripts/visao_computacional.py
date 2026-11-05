from pathlib import Path
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
PASTA = RAIZ / "dados" / "imagens_inspecao"
MANIFESTO = PASTA / "manifesto.csv"
COLUNAS = ["arquivo", "timestamp", "lote_id", "estacao", "classe",
           "anotacao", "temperatura_referencia_c", "revisor"]

def verificar_manifesto():
    PASTA.mkdir(exist_ok=True)
    if not MANIFESTO.exists():
        pd.DataFrame(columns=COLUNAS).to_csv(MANIFESTO, index=False)
        print("Manifesto vazio criado:", MANIFESTO)
        return
    dados = pd.read_csv(MANIFESTO)
    print("Imagens listadas:", len(dados))
    print("Colunas faltando:", sorted(set(COLUNAS) - set(dados.columns)))
    if "arquivo" in dados:
        faltantes = [nome for nome in dados.arquivo if not (PASTA / str(nome)).exists()]
        print("Arquivos não encontrados:", len(faltantes))

if __name__ == "__main__":
    verificar_manifesto()
