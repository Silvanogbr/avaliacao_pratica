# Avaliação prática: análise industrial e IA

Projeto de tratamento e análise de dados de soldagem, modelagem de falhas, detecção de anomalias e proposta de inspeção visual.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `notebooks/` | Notebook de tratamento e análise exploratória |
| `scripts/` | Scripts Python e aplicação web local |
| `web/` | Interface da aplicação em HTML, CSS e JavaScript |
| `relatorios/` | Relatório técnico em Markdown |
| `dados/` | CSV original, CSV tratado e, futuramente, imagens de inspeção |
| `modelos/` | Modelos treinados gerados por `scripts/modelagem.py` |
| `referencias/` | PDF com o enunciado da avaliação |

## Arquivos principais

- `notebooks/tratamento.ipynb`: limpeza, auditoria de zeros, análise exploratória e gráficos.
- `relatorios/relatorio_tecnico.md`: resultados, correlações, modelos, proposta visual, API e ética.
- `scripts/modelagem.py`: treina e avalia o classificador e o detector de anomalias.
- `scripts/simulacao_operacao.py`: simula previsões para revisão humana.
- `scripts/api_inferencia.py`: valida um exemplo de payload.
- `scripts/visao_computacional.py`: cria e confere o manifesto das imagens.
- `scripts/app_web.py`: interface web local para testar API tabular e análise visual.
- `web/index.html`, `web/styles.css`, `web/app.js`: estrutura, estilos e interações da interface.

## Requisitos

Python 3 com `pandas`, `numpy`, `matplotlib`, `scikit-learn`, `joblib`, `fastapi`, `uvicorn`, `python-multipart` e `opencv-python`. Para abrir o notebook, use Jupyter Notebook ou JupyterLab.

```bash
python -m pip install pandas numpy matplotlib scikit-learn joblib jupyter fastapi uvicorn python-multipart opencv-python
```

## Como executar

1. Abra `notebooks/tratamento.ipynb` e execute as células de cima para baixo. O notebook salva `dados/dados_tratados.csv`.
2. Treine os modelos a partir da pasta raiz do projeto:

   ```bash
   python scripts/modelagem.py
   ```

3. Simule as previsões recentes:

   ```bash
   python scripts/simulacao_operacao.py
   ```

4. Verifique payload e manifesto:

   ```bash
   python scripts/api_inferencia.py
   python scripts/visao_computacional.py
   ```

5. Inicie a aplicação web local:

   ```bash
   python scripts/app_web.py
   ```

   Abra `http://127.0.0.1:8000`. A tela permite enviar dados tabulares à API assíncrona e carregar uma imagem para ver uma máscara exploratória de regiões candidatas. A documentação interativa fica em `http://127.0.0.1:8000/docs`.

Se o CSV tratado ainda não existir, os scripts usam o CSV original.

## Tratamento dos zeros

O notebook conta os zeros por coluna antes de qualquer substituição. Neste dataset, os zeros observados representam valores válidos, como nenhuma parada, nenhum defeito ou rótulo negativo de anomalia. Eles não são substituídos automaticamente. A interpretação está detalhada em `relatorios/relatorio_tecnico.md`.

## Imagens de inspeção

Ainda não há imagens no projeto. O script de visão cria `dados/imagens_inspecao/manifesto.csv`. Adicione as imagens nessa pasta e preencha o manifesto com `arquivo`, `timestamp`, `lote_id`, `estacao`, `classe`, `anotacao`, `temperatura_referencia_c` e `revisor`. A tela web usa uma heurística de contraste do OpenCV, não um classificador treinado. O treinamento e a avaliação visual dependem da inclusão de imagens e rótulos revisados.

## Uso operacional

Os modelos são demonstrativos e usam uma divisão temporal. Algumas falhas têm poucos exemplos. Trate as previsões como apoio à inspeção: elas não comandam a máquina e não substituem procedimentos de segurança, alarmes ou intertravamentos.
