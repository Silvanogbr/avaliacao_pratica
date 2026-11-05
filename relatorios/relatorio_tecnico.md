# Relatório técnico: análise de dados industriais e IA

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

## 2. Dados e pipeline

O CSV contém **15.000 registros**, **21 colunas**, **150 lotes**, com medições por minuto entre **1 e 11 de outubro de 2026**. Não há valores ausentes nem timestamps repetidos. O notebook `../notebooks/tratamento.ipynb` ordena e limpa os dados, confere qualidade, calcula estatísticas e apresenta gráficos exploratórios. Ele também salva `../dados/dados_tratados.csv` para os scripts.

Pipeline adotado:

1. Leitura, ordenação e tratamento de dados ausentes e duplicados.
2. Análise das distribuições, falhas, indicadores OEE e correlações.
3. Separação temporal: 80% iniciais para treino e 20% finais para teste.
4. Classificação multiclasse com Random Forest e pesos balanceados.
5. Detecção de anomalias com Isolation Forest treinado nos registros normais.
6. Inferência consultiva, registro e confirmação do operador.

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

## 5. Distribuição das falhas

| Classe | Registros | Proporção |
|---|---:|---:|
| Sem Falha | 13.214 | 88,09% |
| Porosidade na Solda | 1.263 | 8,42% |
| Desvio Térmico HAZ | 388 | 2,59% |
| Sobrecarga de Corrente | 76 | 0,51% |
| Vibração Excessiva | 59 | 0,39% |

A distribuição é bastante desbalanceada. A acurácia geral, sozinha, pode ocultar falhas raras que o modelo não reconhece.

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

## 8. Visão computacional: proposta para porosidade e HAZ

Não foram fornecidas imagens de inspeção neste projeto. Portanto, não é possível treinar ou medir um modelo visual agora.

### Dados necessários

- Imagem ou frame, horário, lote, estação/câmera, classe revisada e identificador do inspetor.
- Para porosidade, máscara ou caixas delimitadoras das regiões identificadas.
- Para análise HAZ, imagem térmica calibrada, temperatura de referência e condições de captura.
- Separação de treino e teste por lote, evitando que imagens do mesmo lote apareçam nos dois conjuntos.

O script `../scripts/visao_computacional.py` prepara e valida `../dados/imagens_inspecao/manifesto.csv`. As classes sugeridas são `sem_defeito`, `porosidade`, `desvio_termico_haz` e `outro`; a engenharia/qualidade deve definir limites térmicos e severidade antes da coleta. A proposta é iniciar com classificação e usar segmentação quando for necessário localizar o defeito. Avaliar precisão, recall, F1 e falsos negativos por classe, câmera e turno. Iniciar em modo sombra e encaminhar baixa confiança para inspeção humana.

### Guia de interpretação dos rótulos

- `sem_defeito`: inspeção revisada sem porosidade ou anomalia térmica fora dos limites aprovados.
- `porosidade`: inspetor confirmou porosidade; preencher `anotacao` com o caminho da máscara ou das caixas delimitadoras.
- `desvio_termico_haz`: medição térmica excede ou não atende ao critério definido pela engenharia; registrar a temperatura de referência e o critério usado.
- `outro`: defeito diferente ou imagem inconclusiva; descrever na anotação e encaminhar para revisão.

Manter uma imagem por inspeção/frame, identificador de lote e estação/câmera. Revisar divergências entre inspetores e separar treino/teste por lote. Nenhuma amostra visual foi inventada ou incluída: os arquivos reais continuam pendentes de recebimento.

## 9. API assíncrona e simulação operacional

O contrato de exemplo está em `../scripts/api_inferencia.py`.

| Método e endpoint | Uso | Resposta principal |
|---|---|---|
| `POST /v1/inferencias` | Envia dados tabulares ou URI de imagem | `202 Accepted`, ID e estado `processando` |
| `GET /v1/inferencias/{id}` | Consulta a inferência | Estado, classe, confiança, versão do modelo e necessidade de revisão |

Erros previstos: `400` para entrada inválida, `401` para cliente não autenticado e `404` para ID inexistente. A entrada tabular inclui timestamp, lote e as oito features do classificador; para imagens, inclui URI e metadados. O exemplo completo está como constante `EXEMPLO_ENTRADA` no script. O script valida o payload; a hospedagem HTTP, autenticação e fila de trabalhos são especificações de integração, não serviços implantados neste projeto.

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

Resposta imediata: `{"id":"inf_123","status":"processando"}`. Consulta concluída: `{"id":"inf_123","status":"concluida","classe":"Porosidade na Solda","confianca":0.82,"revisao_humana":true,"versao_modelo":"1.0.0"}`.

O `../scripts/simulacao_operacao.py` percorre registros recentes, carrega o modelo salvo e recomenda monitoramento ou inspeção. O ciclo é **sinais/imagem → inferência → alerta → confirmação do operador → registro da decisão**. A simulação não envia comandos ao equipamento. Dados inválidos, baixa confiança ou indisponibilidade devem seguir o procedimento manual, mantendo alarmes e intertravamentos existentes.

### Aplicação web de teste

O `../scripts/app_web.py` fornece uma interface local em `http://127.0.0.1:8000` para testar o envio de dados tabulares e consultar o resultado assíncrono por ID. A rota `/docs` expõe a documentação interativa dos endpoints. A tela de imagem recebe um arquivo, mostra a imagem original e uma máscara exploratória baseada em contraste/threshold do OpenCV. Essa heurística serve para testar o fluxo de upload e visualização; não é um modelo treinado nem confirma defeitos. O endpoint limita o upload a 10 MB. A parte HAZ exige câmera térmica calibrada e não estima temperatura a partir de uma imagem RGB.

## 10. Ética, impacto social e segurança

- A IA apoia a inspeção e não substitui operadores, intertravamentos ou procedimentos de segurança.
- Acompanhar falsos negativos por classe, lote, turno e câmera; coletar mais exemplos das classes raras.
- Exibir incerteza e permitir que o operador confirme ou discorde do alerta.
- Limitar acesso e retenção das imagens ao necessário; evitar dados pessoais sem justificativa.
- Envolver operação e manutenção no desenho e na revisão, monitorar deriva e incidentes e oferecer retorno seguro ao processo manual.

## 11. Arquivos de código

- `../notebooks/tratamento.ipynb`: tratamento e análise exploratória com gráficos.
- `relatorio_tecnico.md`: este relatório.
- `../scripts/modelagem.py`: treino, avaliação e gravação dos modelos em `../modelos/`.
- `../scripts/visao_computacional.py`: preparação e validação do manifesto de imagens.
- `../scripts/api_inferencia.py`: contrato e exemplo de payload.
- `../scripts/simulacao_operacao.py`: inferência e simulação consultiva.
- `../scripts/app_web.py`: interface local para testar a API tabular e o fluxo visual.

