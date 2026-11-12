# Relatório técnico: análise de dados industriais e IA

## Sumário

1. [Objetivo](#secao-01)
2. [Dados e pipeline](#secao-02)
3. [Indicadores e OEE](#secao-03)
4. [Auditoria dos valores zero](#secao-04)
5. [Distribuição das falhas](#secao-05)
6. [Correlações com OEE](#secao-06)
7. [Modelos e resultados](#secao-07)
8. [Visão computacional: proposta para porosidade e HAZ](#secao-08)
9. [API assíncrona e simulação operacional](#secao-09)
10. [Ética, impacto social e segurança](#secao-10)
11. [Arquivos de código](#secao-11)

<a id="secao-01"></a>
## 1. Objetivo

Este trabalho organiza os dados de soldagem para apoiar o monitoramento de qualidade, eficiência e falhas. O classificador e o detector produzem alertas para revisão humana; não comandam a linha de produção.

### Competências avaliadas

| Competência | Evidência no projeto |
|---|---|
| C1 — Identificar problemas e oportunidades em dados industriais | Auditoria de zeros, qualidade do CSV, distribuição das falhas e correlações |
| C2 — Implementar algoritmos de IA para aplicações industriais | Classificador multiclasse balanceado, detector de anomalias e simulação de inferência |
| C3 — Utilizar ferramentas de análise de dados na indústria | Tratamento, gráficos, indicadores de OEE e interpretação |
| C4 — Utilizar visão computacional em sistemas industriais | Proposta de inspeção de porosidade/HAZ, metadados e plano de validação por imagens |
| C5 — Reconhecer ética e impacto social da IA | Revisão humana, segurança, viés, privacidade, impacto no trabalho e monitoramento |

<a id="secao-02"></a>
## 2. Dados e pipeline

O CSV contém **15.000 registros**, **21 colunas**, **150 lotes**, com medições por minuto entre **1 e 11 de outubro de 2026**. Não há valores ausentes nem timestamps repetidos. O notebook `../notebooks/tratamento.ipynb` ordena e limpa os dados, confere qualidade, calcula estatísticas e apresenta gráficos exploratórios. Ele também salva `../dados/dados_tratados.csv` para os scripts.

Pipeline adotado:

1. Leitura, ordenação e tratamento de dados ausentes e duplicados.
2. Análise das distribuições, falhas, indicadores OEE e correlações.
3. Separação temporal: 80% iniciais para treino e 20% finais para teste.
4. Classificação multiclasse com Random Forest e pesos balanceados.
5. Detecção de anomalias com Isolation Forest treinado nos registros normais.
6. Inferência consultiva e simulação de recomendações para revisão humana. A aplicação não grava a confirmação do operador.

As features dos modelos são temperatura da solda, corrente, tensão, pressão do gás, vibração, velocidade da linha, indicador numérico de porosidade e temperatura máxima HAZ. OEE, contagens de produção e defeitos ficam fora das features porque são resultados do processo. `area_porosidade_px` é um sinal tabular; não substitui as imagens de inspeção.

### Dicionário de dados

| Coluna | Unidade/formato | Significado |
|---|---|---|
| `timestamp` | data e hora | Instante da medição; intervalo observado de um minuto |
| `lote_id` | texto | Identificador do lote |
| `temperatura_solda_c` | °C | Temperatura do processo de soldagem |
| `corrente_solda_a` | A | Corrente de soldagem |
| `tensao_solda_v` | V | Tensão de soldagem |
| `pressao_gas_bar` | bar | Pressão do gás de proteção |
| `vibracao_mm_s` | mm/s | Vibração do equipamento |
| `velocidade_linha_m_min` | m/min | Velocidade da linha |
| `area_porosidade_px` | px | Área tabular associada à porosidade; não é a imagem |
| `temperatura_max_haz_c` | °C | Temperatura máxima da zona HAZ |
| `tempo_planejado_min` | min | Tempo planejado no intervalo |
| `tempo_parada_min` | min | Tempo parado no intervalo |
| `pecas_produzidas` | peças | Total produzido no intervalo |
| `pecas_boas` | peças | Total aprovado no intervalo |
| `pecas_defeituosas` | peças | Total defeituoso no intervalo |
| `disponibilidade_pct` | % | Indicador de disponibilidade |
| `desempenho_pct` | % | Indicador de desempenho |
| `qualidade_pct` | % | Indicador de qualidade |
| `oee_pct` | % | OEE informado no arquivo |
| `anomalia_isolamento` | 0/1 | Rótulo binário de anomalia |
| `classe_falha` | categoria | Rótulo multiclasse da falha |

<a id="secao-03"></a>
## 3. Indicadores e OEE

O OEE é calculado por:

```text
OEE (%) = disponibilidade (%) × desempenho (%) × qualidade (%) / 10.000
```

| Indicador | Resultado |
|---|---:|
| OEE médio informado | 94,24% |
| OEE recalculado: diferença absoluta média | 0,000 ponto percentual |
| Tempo total de parada | 205,9 min |
| Peças produzidas | 347.662 |
| Peças defeituosas | 13.582 |
| Taxa de defeito | 3,91% |

<a id="secao-04"></a>
## 4. Auditoria dos valores zero

Os zeros foram auditados por coluna antes do tratamento. **Não foram convertidos automaticamente em valores ausentes**, pois a maior parte representa resultados válidos:

| Coluna | Zeros | Interpretação observada |
|---|---:|---|
| `tempo_parada_min` | 14.522 | Intervalos sem parada |
| `pecas_defeituosas` | 10.510 | Intervalos sem peça defeituosa |
| `anomalia_isolamento` | 12.556 | Rótulo negativo: sem anomalia |
| `pecas_produzidas`, `pecas_boas` | 76 cada | Intervalos sem produção, junto de 1 min de parada e OEE 0% |
| `disponibilidade_pct`, `desempenho_pct`, `oee_pct` | 76 cada | Indicadores 0% nos intervalos sem produção |
| `area_porosidade_px` | 11 | Todos os 11 registros estão rotulados `Sem Falha`, com anomalia 0; são compatíveis com ausência de porosidade detectada |

Não existem zeros nas leituras físicas de temperatura, corrente, tensão, pressão, vibração ou velocidade. Substituir os zeros listados por média/mediana apagaria informação de parada, qualidade e rótulo. Se o professor tinha em mente um campo específico, a regra de substituição deve ser aplicada apenas a esse campo após confirmar que zero significa “leitura ausente” no dicionário de dados.

<a id="secao-05"></a>
## 5. Distribuição das falhas

| Classe | Registros | Proporção |
|---|---:|---:|
| Sem Falha | 13.214 | 88,09% |
| Porosidade na Solda | 1.263 | 8,42% |
| Desvio Térmico HAZ | 388 | 2,59% |
| Sobrecarga de Corrente | 76 | 0,51% |
| Vibração Excessiva | 59 | 0,39% |

A distribuição é bastante desbalanceada. A acurácia geral, sozinha, pode ocultar falhas raras que o modelo não reconhece.

<a id="secao-06"></a>
## 6. Correlações com OEE

| Variável | Correlação |
|---|---:|
| Tempo de parada | -0,765 |
| Peças defeituosas | -0,581 |
| Anomalia de isolamento | -0,459 |
| Área de porosidade | -0,422 |
| Temperatura máxima HAZ | -0,279 |
| Temperatura de solda | -0,109 |
| Vibração | -0,010 |
| Velocidade da linha | 0,005 |
| Tensão de solda | 0,010 |
| Corrente de solda | 0,012 |
| Pressão do gás | 0,237 |

Neste conjunto, parada, defeitos e porosidade apresentam associação negativa com OEE. Correlação não demonstra causalidade; investigue eventos, lotes e condições do processo antes de propor ajustes.

<a id="secao-07"></a>
## 7. Modelos e resultados

### Classificação multiclasse

O `../scripts/modelagem.py` usa Random Forest com `class_weight="balanced"` e uma divisão temporal. No teste de 3.000 registros, a acurácia balanceada foi **0,783**. O relatório por classe foi:

| Classe | Suporte no teste | Precisão | Recall | F1 |
|---|---:|---:|---:|---:|
| Desvio Térmico HAZ | 100 | 1,00 | 1,00 | 1,00 |
| Porosidade na Solda | 471 | 1,00 | 1,00 | 1,00 |
| Sem Falha | 2.416 | 1,00 | 1,00 | 1,00 |
| Sobrecarga de Corrente | 1 | 0,00 | 0,00 | 0,00 |
| Vibração Excessiva | 12 | 0,92 | 0,92 | 0,92 |

O único caso de sobrecarga no teste não foi detectado. Essa amostra não permite concluir o desempenho real para a classe; é necessário coletar e validar mais ocorrências antes de qualquer uso operacional.

### Detecção de anomalias

O Isolation Forest foi ajustado com exemplos normais do treino. O limite inicial usa o percentil 95 dos escores desses exemplos. No teste, ROC AUC = **0,739** e F1 = **0,329**. O limite é exploratório e deve ser calibrado conforme o custo de alarmes falsos e falhas não detectadas.

<a id="secao-08"></a>
## 8. Visão computacional: proposta para porosidade e HAZ

Há dois arquivos JPG em `../dados/imagens_inspecao/` para testar o envio e a visualização. Eles não têm classe revisada nem metadados de captura confirmados no manifesto; por isso, não são base para treino ou avaliação formal. Também não há imagem térmica radiométrica ou calibração de câmera no projeto.

### Dados necessários

- Imagem ou frame, horário, lote, estação/câmera, classe revisada e identificador do inspetor.
- Para porosidade, máscara ou caixas delimitadoras das regiões identificadas.
- Para análise HAZ, imagem térmica calibrada, temperatura de referência e condições de captura.
- Separação de treino e teste por lote, evitando que imagens do mesmo lote apareçam nos dois conjuntos.

O script `../scripts/visao_computacional.py` prepara e verifica `../dados/imagens_inspecao/manifesto.csv`, incluindo a existência dos arquivos listados. As classes sugeridas são `sem_defeito`, `porosidade`, `desvio_termico_haz` e `outro`; a engenharia/qualidade deve definir limites térmicos e severidade antes da coleta. A proposta é iniciar com classificação e usar segmentação quando for necessário localizar o defeito. Avaliar precisão, recall, F1 e falsos negativos por classe, câmera e turno. Iniciar em modo sombra e encaminhar baixa confiança para inspeção humana.

### Guia de interpretação dos rótulos

- `sem_defeito`: inspeção revisada sem porosidade ou anomalia térmica fora dos limites aprovados.
- `porosidade`: inspetor confirmou porosidade; preencher `anotacao` com o caminho da máscara ou das caixas delimitadoras.
- `desvio_termico_haz`: medição térmica excede ou não atende ao critério definido pela engenharia; registrar a temperatura de referência e o critério usado.
- `outro`: defeito diferente ou imagem inconclusiva; descrever na anotação e encaminhar para revisão.

Manter uma imagem por inspeção/frame, identificador de lote e estação/câmera. Revisar divergências entre inspetores e separar treino/teste por lote. As duas imagens atuais estão registradas no manifesto com os campos desconhecidos em branco e sem rótulo validado. É necessário completar e revisar esses dados antes de usá-las em treino ou avaliação.

Na aplicação, `POST /api/visao` recebe uma foto RGB (até 10 MB) e executa heurísticas exploratórias do OpenCV: marca regiões escuras e aproximadamente arredondadas como candidatas a porosidade e destaca tons dourados, alaranjados ou azulados. O resultado inclui contagens, regiões candidatas e imagens sobrepostas. Isso não é um classificador treinado e pode gerar falsos positivos. A análise de cor em foto RGB não mede temperatura nem confirma HAZ; a análise térmica em °C depende de imagem radiométrica calibrada, que ainda não está disponível.

<a id="secao-09"></a>
## 9. API assíncrona e simulação operacional

`../scripts/api.py` contém a validação simples do payload (`validar_payload`) e a lista das oito features tabulares. Ele aceita `tipo="tabular"` ou `tipo="imagem"`; para imagem, valida a presença de `imagem_uri`. Esse validador não hospeda rotas HTTP. A aplicação HTTP está em `../scripts/app_web.py` e usa upload de arquivo para a análise visual.

| Método e endpoint | Uso | Resposta principal |
|---|---|---|
| `GET /health` | Verifica o serviço e a disponibilidade dos modelos | Estado e `modelos_carregados` |
| `POST /api/inferencias` | Envia JSON de inferência tabular | `202 Accepted`, ID e estado inicial `processando` |
| `GET /api/inferencias/{job_id}` | Consulta uma inferência pelo ID | Estado, classe, confiança, anomalia, ação sugerida e revisão humana |
| `POST /api/visao` | Envia imagem no campo multipart `file` | Métricas visuais, regiões candidatas e duas sobreposições em Base64 |

Na inferência tabular, o JSON precisa conter `tipo="tabular"`, timestamp ISO-8601, `lote_id` e as oito features numéricas em `dados`. A resposta inicial contém `id` e `status`; a consulta posterior contém também classe, confiança, escore de anomalia, ação sugerida e `revisao_humana`. Os resultados ficam em memória no processo e não incluem versão do modelo. A aplicação não implementa autenticação nem persistência de decisões do operador. Erros observáveis incluem `400` para payload/tipo inválidos, `503` quando os modelos não estão disponíveis, `404` para ID inexistente, `413` para arquivo acima de 10 MB e `400` para arquivo que não pode ser lido como imagem.

Exemplo de entrada tabular:

```json
{
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
    "temperatura_max_haz_c": 227.7
  },
  "imagem_uri": null
}
```

Resposta imediata: `{"id":"<uuid>","status":"processando"}`. A consulta concluída inclui `classe`, `confianca`, `anomalia`, `escore_anomalia`, `acao_sugerida`, `revisao_humana` e `lote_id`; os valores dependem da inferência executada.

O `../scripts/simulacao_operacao.py` percorre os cinco registros mais recentes, carrega o classificador salvo e imprime classe, confiança e ação sugerida. O ciclo operacional proposto é **sinais/imagem → inferência → alerta → confirmação do operador → registro da decisão**; no código atual, a simulação não grava essa confirmação, não implementa a etapa de imagem e não envia comandos ao equipamento. Dados inválidos, baixa confiança ou indisponibilidade devem seguir o procedimento manual, mantendo alarmes e intertravamentos existentes.

### Aplicação web de teste

O `../scripts/app_web.py` fornece a interface local em `http://127.0.0.1:8000`; a rota `/docs` expõe a documentação interativa dos endpoints. A inferência tabular é assíncrona no processo da aplicação. A inspeção visual marca candidatos a porosidade e regiões por cor na foto enviada, mas é exploratória: não confirma defeitos e não calcula temperatura HAZ a partir de RGB.

<a id="secao-10"></a>
## 10. Ética, impacto social e segurança

- A IA apoia a inspeção e não substitui operadores, intertravamentos ou procedimentos de segurança.
- Acompanhar falsos negativos por classe, lote, turno e câmera; coletar mais exemplos das classes raras.
- Exibir incerteza e permitir que o operador confirme ou discorde do alerta.
- Limitar acesso e retenção das imagens ao necessário; evitar dados pessoais sem justificativa.
- Envolver operação e manutenção no desenho e na revisão, monitorar deriva e incidentes e oferecer retorno seguro ao processo manual.

<a id="secao-11"></a>
## 11. Arquivos de código

- `../notebooks/tratamento.ipynb`: tratamento e análise exploratória com gráficos.
- `relatorio_tecnico.md`: este relatório.
- `../scripts/modelagem.py`: treino, avaliação e gravação dos modelos em `../modelos/`.
- `../scripts/visao_computacional.py`: preparação e validação do manifesto de imagens.
- `../scripts/api.py`: features e validação simples do payload de exemplo.
- `../scripts/simulacao_operacao.py`: inferência e simulação consultiva.
- `../scripts/app_web.py`: interface local para testar a API tabular e o fluxo visual.

