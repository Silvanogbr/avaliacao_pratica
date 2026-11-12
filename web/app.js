const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const inferenceForm = document.querySelector('#inference-form');
const inferenceResult = document.querySelector('#inference-result');
const imageForm = document.querySelector('#image-form');
const imageResult = document.querySelector('#image-result');

document.querySelector('#timestamp').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString().slice(0, 16);

tabs.forEach((tab) => tab.addEventListener('click', () => {
  tabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
  });
  panels.forEach((panel) => {
    const active = panel.id === tab.dataset.panel;
    panel.hidden = !active;
    panel.classList.toggle('is-visible', active);
  });
}));

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Falha na API (${response.status}).`);
  return body;
}

async function checkHealth() {
  const dot = document.querySelector('#health-dot');
  const text = document.querySelector('#health-text');
  try {
    const health = await request('/health');
    dot.className = 'status-dot online';
    text.textContent = health.modelos_carregados ? 'API conectada · modelos carregados' : 'API conectada · modelos indisponíveis';
    if (!health.modelos_carregados) dot.className = 'status-dot';
  } catch {
    dot.className = 'status-dot offline';
    text.textContent = 'API indisponível';
  }
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.dataset.label ||= button.textContent;
  button.firstChild.textContent = busy ? label : button.dataset.label;
}

function showError(element, error) {
  element.hidden = false;
  element.innerHTML = `<strong class="error">Não foi possível concluir:</strong> ${escapeHtml(error.message)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderInference(result) {
  if (result.status === 'erro') throw new Error(result.detalhe || 'A inferência falhou.');
  if (result.status === 'processando') {
    inferenceResult.hidden = false;
    inferenceResult.innerHTML = '<strong>Análise em andamento…</strong><br>Consultando o resultado da API.';
    return false;
  }
  inferenceResult.hidden = false;
  inferenceResult.innerHTML = `<p class="result-title"><span class="success-mark">●</span> Resultado da análise</p>
    <div class="result-grid"><span>Classe sugerida</span><strong>${escapeHtml(result.classe)}</strong>
    <span>Confiança</span><strong>${Math.round(result.confianca * 100)}%</strong>
    <span>Anomalia</span><strong>${result.anomalia ? 'Detectada' : 'Não detectada'}</strong>
    <span>Escore de anomalia</span><strong>${escapeHtml(result.escore_anomalia)}</strong>
    <span>Lote</span><strong>${escapeHtml(result.lote_id)}</strong>
    <span>Ação sugerida</span><strong>${escapeHtml(result.acao_sugerida)}</strong></div>
    <p>Revisão humana: <strong>${result.revisao_humana ? 'necessária' : 'não indicada'}</strong> · ID ${escapeHtml(result.id)}</p>`;
  return true;
}

inferenceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = inferenceForm.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(inferenceForm).entries());
  const timestamp = new Date(values.timestamp);
  const features = ['temperatura_solda_c', 'corrente_solda_a', 'tensao_solda_v', 'pressao_gas_bar', 'vibracao_mm_s', 'velocidade_linha_m_min', 'area_porosidade_px', 'temperatura_max_haz_c'];
  const payload = {
    tipo: 'tabular',
    timestamp: timestamp.toISOString(),
    lote_id: values.lote_id,
    dados: Object.fromEntries(features.map((name) => [name, Number(values[name])])),
  };
  setBusy(button, true, 'Enviando…');
  inferenceResult.hidden = false;
  inferenceResult.textContent = 'Enviando medições para a API…';
  try {
    const job = await request('/api/inferencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    let result = job;
    for (let attempt = 0; result.status === 'processando' && attempt < 20; attempt += 1) {
      renderInference(result);
      await new Promise((resolve) => setTimeout(resolve, 500));
      result = await request(`/api/inferencias/${encodeURIComponent(job.id)}`);
    }
    if (!renderInference(result)) throw new Error('O tempo de espera terminou. Consulte novamente ou envie os dados outra vez.');
  } catch (error) {
    showError(inferenceResult, error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#image-file').addEventListener('change', (event) => {
  document.querySelector('#file-label').textContent = event.target.files[0]?.name || 'Escolha uma imagem';
});

imageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = imageForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Analisando…');
  imageResult.hidden = false;
  imageResult.textContent = 'Enviando imagem para a API…';
  try {
    const response = await request('/api/visao', { method: 'POST', body: new FormData(imageForm) });
    const summary = response.resumo;
    imageResult.innerHTML = `<p class="result-title">Visualização exploratória pronta</p><div class="result-grid">
      <span>Imagem</span><strong>${escapeHtml(response.nome_arquivo)}</strong>
      <span>Dimensões</span><strong>${summary.largura} × ${summary.altura}</strong>
      <span>Brilho médio</span><strong>${summary.brilho_medio}</strong>
      <span>Contraste</span><strong>${summary.contraste}</strong>
      <span>Regiões candidatas</span><strong>${summary.regioes_candidatas_heuristicas}</strong></div>
      <img alt="Imagem com regiões candidatas destacadas" src="data:image/png;base64,${response.overlay_base64}">
      <p>${escapeHtml(summary.resultado)}</p>`;
  } catch (error) {
    showError(imageResult, error);
  } finally {
    setBusy(button, false);
  }
});

checkHealth();
setInterval(checkHealth, 15000);
