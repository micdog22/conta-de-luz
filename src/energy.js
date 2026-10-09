// Consumo de energia por aparelho e peso de cada um na conta de luz. Módulo puro, sem DOM.

/**
 * Aparelhos comuns com valores aproximados (confira sempre a etiqueta do aparelho).
 * Potência em W, ou consumo mensal em kWh (geladeira e freezer: valor da etiqueta de eficiência).
 * Tempo e dias são só um ponto de partida para o usuário ajustar.
 */
export const PRESETS = Object.freeze([
  { name: 'Chuveiro elétrico', watts: 5500, time: '0:40', days: 30 },
  { name: 'Ar-condicionado 9.000 BTU inverter', watts: 800, time: '8:00', days: 30 },
  { name: 'Ar-condicionado 12.000 BTU', watts: 1100, time: '8:00', days: 30 },
  { name: 'Geladeira frost free', kwhMonth: 45 },
  { name: 'Freezer', kwhMonth: 40 },
  { name: 'Micro-ondas', watts: 1200, time: '0:20', days: 30 },
  { name: 'Forno elétrico', watts: 1500, time: '0:30', days: 8 },
  { name: 'Air fryer', watts: 1500, time: '0:30', days: 20 },
  { name: 'Ferro de passar', watts: 1000, time: '1:00', days: 4 },
  { name: 'Máquina de lavar', watts: 500, time: '1:00', days: 8 },
  { name: 'Secadora', watts: 2500, time: '1:00', days: 8 },
  { name: 'TV LED 43"', watts: 80, time: '5:00', days: 30 },
  { name: 'Notebook', watts: 65, time: '8:00', days: 22 },
  { name: 'PC gamer', watts: 400, time: '4:00', days: 30 },
  { name: 'Videogame', watts: 150, time: '2:00', days: 30 },
  { name: 'Ventilador', watts: 80, time: '8:00', days: 30 },
  { name: 'Lâmpada LED', watts: 9, time: '5:00', days: 30 },
  { name: 'Roteador Wi-Fi', watts: 10, time: '24:00', days: 30 },
  { name: 'Carregador de celular', watts: 10, time: '2:00', days: 30 },
  { name: 'Secador de cabelo', watts: 1900, time: '0:10', days: 30 },
  { name: 'Chaleira elétrica', watts: 1500, time: '0:10', days: 30 },
  { name: 'Bomba de piscina', watts: 750, time: '4:00', days: 30 },
]);

/** Aparelho no formato do formulário (textos), a partir de um item da lista. */
export function fromPreset(preset) {
  const kwh = preset.kwhMonth !== undefined;
  return {
    name: preset.name,
    mode: kwh ? 'kwh' : 'watts',
    watts: kwh ? '' : String(preset.watts),
    kwhMonth: kwh ? String(preset.kwhMonth).replace('.', ',') : '',
    time: kwh ? '' : preset.time,
    days: kwh ? '' : String(preset.days),
    qty: '1',
  };
}

// ---------- Leitura de números e tempos ----------

/**
 * Número no formato brasileiro ("0,95", "1.500", "45.5"). Ponto vira separador de milhar só com
 * `thousands` e no formato 1.234. Vazio → null; inválido, negativo ou com casas demais → NaN.
 */
export function parseDecimal(text, { thousands = false, maxDecimals = 6 } = {}) {
  const s = String(text ?? '').replace(/\s/g, '');
  if (s === '') return null;
  let normalized;
  if (s.includes(',')) {
    if (!/^(\d{1,3}(\.\d{3})+|\d*),\d*$/.test(s)) return NaN;
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (thousands && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, '');
  } else {
    if (!/^\d*(\.\d*)?$/.test(s)) return NaN;
    normalized = s;
  }
  if (!/\d/.test(normalized)) return NaN;
  const decimals = normalized.includes('.') ? normalized.split('.')[1].length : 0;
  if (decimals > maxDecimals) return NaN;
  return Number(normalized);
}

/**
 * Tempo de uso por dia em minutos. Aceita "0:40", "1:30", "8", "8h", "1h30", "1h30min",
 * "40min", "40 min" e horas decimais ("1,5" = 1h30). Máximo de 24 horas.
 * Vazio → null; inválido → NaN.
 */
export function parseDuration(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (s === '') return null;
  let minutes;
  let m;
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(s))) {
    if (Number(m[2]) > 59) return NaN;
    minutes = Number(m[1]) * 60 + Number(m[2]);
  } else if ((m = /^(\d{1,2})h(?:(\d{1,2})(?:min|m)?)?$/.exec(s))) {
    if (m[2] !== undefined && Number(m[2]) > 59) return NaN;
    minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  } else if ((m = /^(\d{1,4})(?:min|m)$/.exec(s))) {
    minutes = Number(m[1]);
  } else if ((m = /^(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(s))) {
    minutes = Math.round(Number(`${m[1]}.${m[2] ?? '0'}`) * 60);
  } else {
    return NaN;
  }
  return minutes > 1440 ? NaN : minutes;
}

export function formatDuration(minutes) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

function parseCount(text, min, max, fallback) {
  const s = String(text ?? '').trim();
  if (s === '') return fallback;
  const n = Number(s);
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
}

// ---------- Cálculos ----------

/** kWh por mês de um aparelho: W × horas por dia × dias × quantidade ÷ 1000, ou kWh/mês × quantidade. */
export function applianceKwh(appliance) {
  const errors = [];
  const qty = parseCount(appliance.qty, 1, 999, 1);
  if (Number.isNaN(qty)) errors.push('Quantidade: use um número inteiro de 1 a 999.');

  if (appliance.mode === 'kwh') {
    const monthly = parseDecimal(appliance.kwhMonth, { thousands: true, maxDecimals: 2 });
    if (monthly === null) errors.push('Informe o consumo em kWh por mês (está na etiqueta do aparelho).');
    else if (Number.isNaN(monthly) || monthly <= 0) errors.push('Consumo em kWh por mês inválido: use, por exemplo, 45 ou 38,5.');
    return errors.length ? { kwh: null, errors } : { kwh: monthly * qty, errors };
  }

  const watts = parseDecimal(appliance.watts, { thousands: true, maxDecimals: 1 });
  if (watts === null) errors.push('Informe a potência em watts (W).');
  else if (Number.isNaN(watts) || watts <= 0 || watts > 100000) errors.push('Potência inválida: use os watts da etiqueta, por exemplo, 5500.');
  const minutes = parseDuration(appliance.time);
  if (minutes === null) errors.push('Informe o tempo de uso por dia, por exemplo, 0:40.');
  else if (Number.isNaN(minutes)) errors.push('Tempo por dia inválido: use, por exemplo, 0:40, 1h30 ou 2 (horas), até 24 horas.');
  const days = parseCount(appliance.days, 1, 31, NaN);
  if (Number.isNaN(days)) errors.push('Dias por mês: use um número inteiro de 1 a 31.');
  if (errors.length) return { kwh: null, errors };
  return { kwh: (watts * (minutes / 60) * days * qty) / 1000, errors };
}

/**
 * Calcula a lista toda. tariff: R$ por kWh; flag: adicional da bandeira em R$ por 100 kWh (opcional).
 * Aparelhos com erro ficam de fora dos totais e do ranking.
 */
export function computeBill({ appliances, tariff, flag }) {
  const errors = [];
  let price = null;
  const t = parseDecimal(tariff, { maxDecimals: 6 });
  const f = parseDecimal(flag, { maxDecimals: 4 }) ?? 0;
  if (t !== null && (Number.isNaN(t) || t <= 0 || t > 100)) errors.push('Tarifa inválida: use o valor em R$ por kWh, por exemplo, 0,95.');
  if (Number.isNaN(f) || f > 1000) errors.push('Adicional da bandeira inválido: use o valor em R$ por 100 kWh, por exemplo, 4,46 (ou 0).');
  if (t !== null && !errors.length) price = t + f / 100;

  const rows = appliances.map((a, index) => {
    const { kwh, errors: rowErrors } = applianceKwh(a);
    return {
      index,
      name: String(a.name ?? '').trim() || `Aparelho ${index + 1}`,
      kwh,
      cost: kwh !== null && price !== null ? kwh * price : null,
      share: 0,
      errors: rowErrors,
    };
  });
  const valid = rows.filter((r) => r.kwh !== null);
  const totalKwh = valid.reduce((sum, r) => sum + r.kwh, 0);
  for (const r of valid) r.share = totalKwh > 0 ? (r.kwh / totalKwh) * 100 : 0;
  const ranking = [...valid].sort((a, b) => b.kwh - a.kwh || a.index - b.index);
  return {
    errors,
    rows,
    ranking,
    totalKwh,
    pricePerKwh: price,
    totalCost: price !== null ? totalKwh * price : null,
    flagCost: price !== null ? (totalKwh / 100) * f : null,
  };
}

// ---------- Formatação e CSV ----------

export function formatNumber(value, decimals) {
  const [int, frac] = Math.abs(value).toFixed(decimals).split('.');
  return `${value < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${frac ? `,${frac}` : ''}`;
}

export function formatBRL(value) {
  return `R$ ${formatNumber(Math.round(value * 100) / 100, 2)}`;
}

function csvNumber(value, decimals) {
  return value === null || value === undefined ? '' : value.toFixed(decimals).replace('.', ',');
}

/** Campo de CSV: aspas quando precisa e proteção contra fórmulas ao abrir na planilha. */
export function csvField(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com ponto e vírgula e vírgula decimal (abre direto no Excel e no LibreOffice em português). */
export function toCSV(appliances, bill) {
  const header = ['Aparelho', 'Potência (W)', 'Consumo informado (kWh/mês)', 'Tempo por dia', 'Dias por mês', 'Quantidade', 'kWh/mês', 'R$/mês', 'Participação (%)'];
  const lines = [header.map(csvField).join(';')];
  bill.rows.forEach((row, i) => {
    const a = appliances[i];
    const watts = a.mode === 'kwh' ? '' : a.watts;
    const kwhMonth = a.mode === 'kwh' ? a.kwhMonth : '';
    const minutes = a.mode === 'kwh' ? null : parseDuration(a.time);
    lines.push([
      row.name, watts, kwhMonth, Number.isFinite(minutes) ? formatDuration(minutes) : '', a.mode === 'kwh' ? '' : a.days, a.qty,
      csvNumber(row.kwh, 2), csvNumber(row.cost, 2), row.kwh === null ? '' : csvNumber(row.share, 1),
    ].map(csvField).join(';'));
  });
  lines.push(['Total', '', '', '', '', '', csvNumber(bill.totalKwh, 2), csvNumber(bill.totalCost, 2), bill.totalKwh > 0 ? '100,0' : ''].map(csvField).join(';'));
  return `${lines.join('\r\n')}\r\n`;
}
