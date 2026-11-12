const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('.panel')];
const inferenceForm = document.querySelector('#inference-form');
const inferenceResult = document.querySelector('#inference-result');
const imageForm = document.querySelector('#image-form');
const imageResult = document.querySelector('#image-result');
const imageInput = document.querySelector('#image-file');
const uploadZone = document.querySelector('#upload-zone');
const imagePreview = document.querySelector('#image-preview');
const themeToggle = document.querySelector('#theme-toggle');

const featureNames = [
  'temperatura_solda_c', 'corrente_solda_a', 'tensao_solda_v',
  'pressao_gas_bar', 'vibracao_mm_s', 'velocidade_linha_m_min',
  'area_porosidade_px', 'temperatura_max_haz_c',
];
const exampleValues = {
  temperatura_solda_c: 216.8,
  corrente_solda_a: 160.2,
  tensao_solda_v: 23.7,
  pressao_gas_bar: 4.5,
  vibracao_mm_s: 1.2,
  velocidade_linha_m_min: 12,
  area_porosidade_px: 7.6,
  temperatura_max_haz_c: 227.7,
};
let previewUrl = null;

function setTheme(theme, save = true) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#080a08' : '#ffffff';
  const nextThemeLabel = isDark ? 'claro' : 'escuro';
  themeToggle.setAttribute('aria-label', `Ativar tema ${nextThemeLabel}`);
  themeToggle.title = `Ativar tema ${nextThemeLabel}`;
  themeToggle.innerHTML = isDark
    ? '<span class="theme-icon" aria-hidden="true">☼</span><span class="theme-label">Tema claro</span>'
    : '<span class="theme-icon" aria-hidden="true">☾</span><span class="theme-label">Tema escuro</span>';
  if (save) {
    try { localStorage.setItem('qualitylab-theme', isDark ? 'dark' : 'light'); } catch {}
  }
}

themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
setTheme(document.documentElement.dataset.theme || 'dark', false);

function setCurrentTimestamp() {
  const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  document.querySelector('#timestamp').value = localDate.toISOString().slice(0, 16);
}

function activateTab(tab) {
  tabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  });
  panels.forEach((panel) => {
    const active = panel.id === tab.dataset.panel;
    panel.hidden = !active;
    panel.classList.toggle('is-visible', active);
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[nextIndex].focus();
    activateTab(tabs[nextIndex]);
  });
});

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
    dot.className = health.modelos_carregados ? 'status-dot online' : 'status-dot';
    text.textContent = health.modelos_carregados
      ? 'API conectada · modelos prontos'
      : 'API conectada · modelos indisponíveis';
  } catch {
    dot.className = 'status-dot offline';
    text.textContent = 'API indisponível';
  }
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  const text = button.querySelector('span:first-child');
  button.dataset.label ||= text.textContent;
  text.textContent = busy ? label : button.dataset.label;
  button.setAttribute('aria-busy', String(busy));
}

function showError(element, error) {
  element.hidden = false;
  element.innerHTML = `<strong class="error">Não foi possível concluir:</strong> ${escapeHtml(error.message)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function renderInference(result) {
  if (result.status === 'erro') throw new Error(result.detalhe || 'A inferência falhou.');
  inferenceResult.hidden = false;
  if (result.status === 'processando') {
    inferenceResult.innerHTML = '<strong>Análise em andamento…</strong><br>Consultando o resultado da API.';
    return false;
  }

  const confidence = Math.max(0, Math.min(100, Math.round(Number(result.confianca) * 100)));
  const anomalyText = result.anomalia ? 'Detectada' : 'Não detectada';
  inferenceResult.innerHTML = `<p class="result-title"><span class="success-mark">●</span> Resultado da análise</p>
    <div class="result-grid"><span>Classe sugerida</span><strong>${escapeHtml(result.classe)}</strong>
    <span>Anomalia</span><strong>${anomalyText}</strong>
    <span>Escore de anomalia</span><strong>${escapeHtml(result.escore_anomalia)}</strong>
    <span>Lote</span><strong>${escapeHtml(result.lote_id)}</strong>
    <span>Ação sugerida</span><strong>${escapeHtml(result.acao_sugerida)}</strong></div>
    <div class="confidence-meter"><span>Confiança</span><progress value="${confidence}" max="100" aria-label="Confiança do modelo"></progress><strong>${confidence}%</strong></div>
    <p>Revisão humana: <strong>${result.revisao_humana ? 'necessária' : 'não indicada'}</strong> · ID ${escapeHtml(result.id)}</p>`;
  return true;
}

document.querySelector('#load-sample').addEventListener('click', () => {
  Object.entries(exampleValues).forEach(([name, value]) => {
    inferenceForm.elements[name].value = value;
  });
  inferenceForm.elements.lote_id.value = 'LOTE_TESTE_001';
  setCurrentTimestamp();
  inferenceResult.hidden = true;
  inferenceForm.elements.lote_id.focus();
});

inferenceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!inferenceForm.reportValidity()) return;

  const button = inferenceForm.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(inferenceForm).entries());
  const payload = {
    tipo: 'tabular',
    timestamp: new Date(values.timestamp).toISOString(),
    lote_id: values.lote_id.trim(),
    dados: Object.fromEntries(featureNames.map((name) => [name, Number(values[name])])),
  };

  setBusy(button, true, 'Enviando…');
  inferenceResult.hidden = false;
  inferenceResult.textContent = 'Enviando medições para a API…';
  try {
    const job = await request('/api/inferencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let result = job;
    for (let attempt = 0; result.status === 'processando' && attempt < 30; attempt += 1) {
      renderInference(result);
      await new Promise((resolve) => setTimeout(resolve, 500));
      result = await request(`/api/inferencias/${encodeURIComponent(job.id)}`);
    }
    if (!renderInference(result)) {
      throw new Error('A análise ainda está em andamento. Aguarde e consulte o ID na documentação da API.');
    }
  } catch (error) {
    showError(inferenceResult, error);
  } finally {
    setBusy(button, false);
  }
});

function formatFileSize(bytes) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function clearImagePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  imageInput.value = '';
  imagePreview.hidden = true;
  document.querySelector('#file-label').textContent = 'Escolha ou arraste uma foto';
  document.querySelector('#preview-image').removeAttribute('src');
  imageResult.hidden = true;
}

function chooseImage(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    clearImagePreview();
    showError(imageResult, new Error('Escolha um arquivo de imagem.'));
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    clearImagePreview();
    showError(imageResult, new Error('A imagem deve ter no máximo 10 MB.'));
    return;
  }

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const transfer = new DataTransfer();
  transfer.items.add(file);
  imageInput.files = transfer.files;
  previewUrl = URL.createObjectURL(file);
  document.querySelector('#preview-image').src = previewUrl;
  document.querySelector('#preview-name').textContent = file.name;
  document.querySelector('#preview-details').textContent = formatFileSize(file.size);
  document.querySelector('#file-label').textContent = 'Foto pronta para análise';
  imagePreview.hidden = false;
  imageResult.hidden = true;
}

imageInput.addEventListener('change', () => chooseImage(imageInput.files[0]));
document.querySelector('#clear-image').addEventListener('click', clearImagePreview);
uploadZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    imageInput.click();
  }
});
['dragenter', 'dragover'].forEach((eventName) => uploadZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  uploadZone.classList.add('dragover');
}));
['dragleave', 'drop'].forEach((eventName) => uploadZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  uploadZone.classList.remove('dragover');
}));
uploadZone.addEventListener('drop', (event) => chooseImage(event.dataTransfer.files[0]));

imageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!imageInput.files[0]) {
    showError(imageResult, new Error('Escolha uma foto antes de analisar.'));
    return;
  }
  const button = imageForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Analisando…');
  imageResult.hidden = false;
  imageResult.textContent = 'Enviando foto para a API…';
  try {
    const response = await request('/api/visao', { method: 'POST', body: new FormData(imageForm) });
    const { resumo, porosidade, termica_visual: colorAnalysis } = response;
    const baseName = response.nome_arquivo.replace(/[^\w.-]+/g, '-');
    const original = previewUrl
      ? `<figure><img alt="Foto original enviada" src="${previewUrl}"><figcaption>Foto enviada</figcaption></figure>`
      : '';
    imageResult.innerHTML = `<p class="result-title">Análise concluída · ${escapeHtml(response.nome_arquivo)}</p>
      <div class="result-grid"><span>Dimensões</span><strong>${resumo.largura} × ${resumo.altura} px</strong>
      <span>Candidatos visuais a porosidade</span><strong>${porosidade.candidatos_visuais}</strong>
      <span>Regiões em tons dourados/alaranjados/azulados</span><strong>${colorAnalysis.regioes_coloridas}</strong>
      <span>Área da foto nesses tons</span><strong>${colorAnalysis.area_colorida_pct}%</strong></div>
      <div class="result-visuals">${original}
        <figure><img alt="Candidatos a porosidade marcados em vermelho" src="data:image/png;base64,${response.overlay_porosidade_base64}"><figcaption>Porosidade · caixas vermelhas</figcaption><a class="download-link" download="porosidade-${baseName}.png" href="data:image/png;base64,${response.overlay_porosidade_base64}">Baixar imagem</a></figure>
        <figure><img alt="Tons destacados como indicador visual de cor" src="data:image/png;base64,${response.overlay_termica_base64}"><figcaption>Indicador visual de cor · áreas destacadas</figcaption><a class="download-link" download="cores-${baseName}.png" href="data:image/png;base64,${response.overlay_termica_base64}">Baixar imagem</a></figure>
      </div><p>${escapeHtml(porosidade.resultado)} ${escapeHtml(colorAnalysis.resultado)}</p>`;
  } catch (error) {
    showError(imageResult, error);
  } finally {
    setBusy(button, false);
  }
});

setCurrentTimestamp();
checkHealth();
setInterval(checkHealth, 15000);
