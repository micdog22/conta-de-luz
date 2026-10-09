import { PRESETS, fromPreset, computeBill, formatNumber, formatBRL, toCSV } from './energy.js';

const STORAGE_KEY = 'conta-de-luz:v1';
const $ = (id) => document.getElementById(id);
const TEXT_KEYS = ['name', 'watts', 'kwhMonth', 'time', 'days', 'qty'];

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

let nextId = 1;
function withId(appliance) {
  const clean = { id: nextId++, mode: appliance.mode === 'kwh' ? 'kwh' : 'watts' };
  for (const key of TEXT_KEYS) clean[key] = typeof appliance[key] === 'string' ? appliance[key] : '';
  return clean;
}

function defaultState() {
  const pick = (name) => withId(fromPreset(PRESETS.find((p) => p.name === name)));
  return {
    tariff: '',
    flag: '',
    appliances: ['Chuveiro elétrico', 'Geladeira frost free', 'TV LED 43"', 'Roteador Wi-Fi'].map(pick),
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && Array.isArray(saved.appliances)) {
      return {
        tariff: typeof saved.tariff === 'string' ? saved.tariff : '',
        flag: typeof saved.flag === 'string' ? saved.flag : '',
        appliances: saved.appliances.filter((a) => a && typeof a === 'object').map(withId),
      };
    }
  } catch {
    // armazenamento indisponível ou corrompido: começa com a lista de exemplo
  }
  return defaultState();
}

function save() {
  try {
    const { tariff, flag, appliances } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tariff, flag, appliances: appliances.map(({ id, ...rest }) => rest) }));
  } catch {
    // sem armazenamento: segue sem salvar
  }
}

let state = load();

function currentBill() {
  return computeBill({ appliances: state.appliances, tariff: state.tariff, flag: state.flag });
}

// ---------- Lista de aparelhos ----------

function applianceRow(appliance, i) {
  const base = `ap-${appliance.id}`;
  const field = (key, label, attrs = {}) => {
    const input = el('input', { id: `${base}-${key}`, autocomplete: 'off', ...attrs });
    input.value = appliance[key];
    input.addEventListener('input', () => {
      appliance[key] = input.value;
      changed();
    });
    return el('div', { class: `campo campo-${key}` }, el('label', { for: input.id, text: label }), input);
  };
  const name = field('name', 'Aparelho', { maxlength: '60', placeholder: `Aparelho ${i + 1}` });
  const mode = el('select', { id: `${base}-mode` },
    el('option', { value: 'watts', text: 'potência (W) e tempo de uso' }),
    el('option', { value: 'kwh', text: 'consumo em kWh por mês' }));
  mode.value = appliance.mode;
  const watts = field('watts', 'Potência (W)', { inputmode: 'decimal' });
  const time = field('time', 'Tempo por dia', { placeholder: 'h:mm' });
  const days = field('days', 'Dias por mês', { inputmode: 'numeric' });
  const kwh = field('kwhMonth', 'Consumo (kWh/mês)', { inputmode: 'decimal' });
  const qty = field('qty', 'Quantidade', { inputmode: 'numeric' });
  const toggle = () => {
    for (const box of [watts, time, days]) box.hidden = appliance.mode === 'kwh';
    kwh.hidden = appliance.mode !== 'kwh';
  };
  mode.addEventListener('change', () => {
    appliance.mode = mode.value;
    toggle();
    changed();
  });
  toggle();
  const remove = el('button', { type: 'button', class: 'remover', 'aria-label': `Remover aparelho ${i + 1}` }, '×');
  remove.addEventListener('click', () => {
    state.appliances = state.appliances.filter((a) => a !== appliance);
    renderList();
    changed();
  });
  return el('fieldset', { class: 'aparelho' },
    el('legend', { class: 'sr-only', text: `Aparelho ${i + 1}` }),
    el('div', { class: 'topo' }, name, el('div', { class: 'campo campo-modo' }, el('label', { for: mode.id, text: 'Informar' }), mode), remove),
    el('div', { class: 'campos' }, watts, time, days, kwh, qty),
    el('p', { class: 'resumo-aparelho', id: `${base}-resumo` }));
}

function renderList() {
  const box = $('lista');
  if (!state.appliances.length) {
    box.replaceChildren(el('p', { class: 'muted', text: 'Nenhum aparelho na lista. Escolha um aparelho comum acima ou adicione outro.' }));
    return;
  }
  box.replaceChildren(...state.appliances.map(applianceRow));
}

// ---------- Resultado ----------

function renderResult(bill) {
  bill.rows.forEach((row, i) => {
    const node = $(`ap-${state.appliances[i].id}-resumo`);
    if (!node) return;
    node.classList.toggle('erro', row.errors.length > 0);
    node.textContent = row.errors.length
      ? row.errors.join(' ')
      : `${formatNumber(row.kwh, 1)} kWh por mês${row.cost !== null ? ` · ${formatBRL(row.cost)} por mês` : ''}`;
  });

  const nodes = [];
  if (bill.errors.length) nodes.push(el('ul', { class: 'erros' }, ...bill.errors.map((e) => el('li', { text: e }))));
  $('exportar').disabled = bill.ranking.length === 0;
  if (!bill.ranking.length) {
    nodes.push(el('p', { class: 'muted', text: 'Adicione aparelhos com os dados preenchidos para ver quanto cada um pesa.' }));
    $('resultado').replaceChildren(...nodes);
    return;
  }

  const total = el('p', { class: 'total' }, 'Total: ', el('strong', { text: `${formatNumber(bill.totalKwh, 1)} kWh` }), ' por mês');
  if (bill.totalCost !== null) total.append(' · ', el('strong', { text: formatBRL(bill.totalCost) }));
  nodes.push(total);
  if (bill.totalCost === null && !bill.errors.length) nodes.push(el('p', { class: 'hint', text: 'Informe a tarifa para ver os valores em reais.' }));
  if (bill.flagCost) nodes.push(el('p', { class: 'hint', text: `Inclui ${formatBRL(bill.flagCost)} do adicional da bandeira tarifária.` }));

  const list = el('ol', { class: 'ranking' });
  for (const row of bill.ranking) {
    const fill = el('span');
    fill.style.width = `${Math.max(row.share, 0.5).toFixed(1)}%`;
    const values = `${row.cost !== null ? `${formatBRL(row.cost)} · ` : ''}${formatNumber(row.share, 1)}%`;
    list.append(el('li', {},
      el('div', { class: 'linha' }, el('span', { class: 'nome', text: row.name }), el('span', { class: 'valores', text: values })),
      el('div', { class: 'barra', 'aria-hidden': 'true' }, fill),
      el('span', { class: 'kwh', text: `${formatNumber(row.kwh, 1)} kWh por mês` })));
  }
  nodes.push(list);
  const invalid = bill.rows.filter((r) => r.errors.length).length;
  if (invalid) {
    nodes.push(el('p', { class: 'aviso', text: invalid === 1
      ? '1 aparelho com dados incompletos ficou de fora do total.'
      : `${invalid} aparelhos com dados incompletos ficaram de fora do total.` }));
  }
  $('resultado').replaceChildren(...nodes);
}

function changed() {
  save();
  renderResult(currentBill());
}

// ---------- Eventos ----------

const presetSelect = $('preset');
PRESETS.forEach((p, i) => {
  const detail = p.kwhMonth !== undefined ? `${formatNumber(p.kwhMonth, 0)} kWh/mês` : `${formatNumber(p.watts, 0)} W`;
  presetSelect.append(el('option', { value: String(i), text: `${p.name} (${detail})` }));
});

function addAppliance(appliance, focusKey) {
  const added = withId(appliance);
  state.appliances.push(added);
  renderList();
  changed();
  $(`ap-${added.id}-${focusKey}`)?.focus();
}

$('add-preset').addEventListener('click', () => addAppliance(fromPreset(PRESETS[Number(presetSelect.value)]), 'qty'));
$('add-blank').addEventListener('click', () => addAppliance({ name: '', mode: 'watts', watts: '', kwhMonth: '', time: '', days: '30', qty: '1' }, 'name'));

for (const [id, key] of [['tarifa', 'tariff'], ['bandeira', 'flag']]) {
  const input = $(id);
  input.value = state[key];
  input.addEventListener('input', () => {
    state[key] = input.value;
    changed();
  });
}

let confirmTimer = null;
$('limpar').addEventListener('click', () => {
  const button = $('limpar');
  if (!button.dataset.confirm) {
    button.dataset.confirm = '1';
    button.textContent = 'Clique de novo para limpar';
    confirmTimer = setTimeout(() => { delete button.dataset.confirm; button.textContent = 'Limpar lista'; }, 4000);
    return;
  }
  clearTimeout(confirmTimer);
  delete button.dataset.confirm;
  button.textContent = 'Limpar lista';
  state.appliances = [];
  renderList();
  changed();
});

$('exportar').addEventListener('click', () => {
  const csv = toCSV(state.appliances, currentBill());
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = el('a', { href: url, download: 'conta-de-luz.csv' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

renderList();
renderResult(currentBill());
