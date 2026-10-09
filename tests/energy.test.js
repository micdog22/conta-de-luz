import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, fromPreset, parseDecimal, parseDuration, formatDuration, applianceKwh, computeBill,
  formatNumber, formatBRL, csvField, toCSV,
} from '../src/energy.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;
const shower = { name: 'Chuveiro', mode: 'watts', watts: '5500', time: '0:40', days: '30', qty: '1' };
const fridge = { name: 'Geladeira', mode: 'kwh', kwhMonth: '45', qty: '1' };
const tv = { name: 'TV', mode: 'watts', watts: '80', time: '5h', days: '30', qty: '1' };

test('lê o tempo de uso por dia', () => {
  const cases = {
    '0:40': 40, '00:40': 40, '1:30': 90, '8': 480, '8h': 480, '1h30': 90, '1h30min': 90, '1h 30min': 90,
    '40min': 40, '40 min': 40, '90min': 90, '1,5': 90, '0.25': 15, '24:00': 1440, '0:00': 0,
  };
  for (const [text, minutes] of Object.entries(cases)) assert.equal(parseDuration(text), minutes, text);
  assert.equal(parseDuration(''), null);
  for (const bad of ['1:60', '25', '24:01', 'abc', '-1', '1h75', '2:5', '1500min']) assert.ok(Number.isNaN(parseDuration(bad)), bad);
  assert.equal(formatDuration(40), '0:40');
  assert.equal(formatDuration(1440), '24:00');
});

test('lê números no formato brasileiro', () => {
  assert.equal(parseDecimal('0,95'), 0.95);
  assert.equal(parseDecimal('0.95'), 0.95);
  assert.equal(parseDecimal('5.500', { thousands: true }), 5500);
  assert.equal(parseDecimal('1.234,5', { thousands: true }), 1234.5);
  assert.equal(parseDecimal(''), null);
  for (const bad of ['-1', 'abc', ',', '1,2,3']) assert.ok(Number.isNaN(parseDecimal(bad)), bad);
  assert.ok(Number.isNaN(parseDecimal('0,1234567')));
});

test('kWh por mês a partir da potência e do tempo', () => {
  assert.ok(close(applianceKwh(shower).kwh, 110)); // 5500 W × 40 min × 30 dias
  assert.ok(close(applianceKwh({ ...shower, qty: '2' }).kwh, 220));
  assert.ok(close(applianceKwh(tv).kwh, 12)); // 80 W × 5 h × 30
  assert.ok(close(applianceKwh({ ...tv, watts: '10', time: '24:00' }).kwh, 7.2));
  assert.ok(close(applianceKwh({ ...tv, watts: '1.500', time: '0:10', days: '20' }).kwh, 5));
});

test('aparelho informado em kWh por mês', () => {
  assert.equal(applianceKwh(fridge).kwh, 45);
  assert.equal(applianceKwh({ ...fridge, qty: '2' }).kwh, 90);
  assert.equal(applianceKwh({ ...fridge, kwhMonth: '38,5' }).kwh, 38.5);
  assert.match(applianceKwh({ ...fridge, kwhMonth: '' }).errors[0], /kWh por mês/);
  assert.match(applianceKwh({ ...fridge, kwhMonth: '0' }).errors[0], /inválido/);
});

test('erros de cada aparelho', () => {
  assert.match(applianceKwh({ ...shower, watts: '' }).errors.join(' '), /potência/);
  assert.match(applianceKwh({ ...shower, time: '1:75' }).errors.join(' '), /Tempo por dia inválido/);
  assert.match(applianceKwh({ ...shower, days: '32' }).errors.join(' '), /1 a 31/);
  assert.match(applianceKwh({ ...shower, qty: '0' }).errors.join(' '), /Quantidade/);
  assert.equal(applianceKwh({ ...shower, qty: '' }).kwh, 110); // quantidade vazia = 1
});

test('tarifa e adicional da bandeira', () => {
  const bill = computeBill({ appliances: [shower, fridge, { ...tv, watts: '100', qty: '3' }], tariff: '0,90', flag: '4,463' });
  assert.deepEqual(bill.errors, []);
  assert.ok(close(bill.totalKwh, 110 + 45 + 45));
  assert.ok(close(bill.pricePerKwh, 0.94463));
  assert.ok(close(bill.totalCost, 200 * 0.94463));
  assert.ok(close(bill.flagCost, 8.926)); // 200 kWh = 2 × R$ 4,463
  assert.equal(formatBRL(bill.totalCost), 'R$ 188,93');

  const noFlag = computeBill({ appliances: [shower], tariff: '1', flag: '' });
  assert.ok(close(noFlag.totalCost, 110));
  assert.equal(noFlag.flagCost, 0);
});

test('sem tarifa calcula só os kWh; tarifa inválida vira erro', () => {
  const bill = computeBill({ appliances: [shower], tariff: '', flag: '0' });
  assert.equal(bill.pricePerKwh, null);
  assert.equal(bill.totalCost, null);
  assert.equal(bill.rows[0].cost, null);
  assert.ok(close(bill.totalKwh, 110));
  assert.match(computeBill({ appliances: [shower], tariff: '0', flag: '' }).errors[0], /Tarifa inválida/);
  assert.match(computeBill({ appliances: [shower], tariff: '0,9', flag: '-2' }).errors[0], /bandeira/);
});

test('ranking do que mais pesa e participação na conta', () => {
  const bill = computeBill({
    appliances: [tv, shower, fridge, { ...tv, name: 'TV do quarto' }, { ...shower, name: 'Quebrado', watts: 'x' }],
    tariff: '1',
    flag: '',
  });
  assert.deepEqual(bill.ranking.map((r) => r.name), ['Chuveiro', 'Geladeira', 'TV', 'TV do quarto']);
  assert.ok(close(bill.totalKwh, 110 + 45 + 12 + 12)); // o aparelho com erro fica de fora
  assert.ok(close(bill.ranking.reduce((s, r) => s + r.share, 0), 100));
  assert.ok(close(bill.ranking[0].share, (110 / 179) * 100));
  assert.equal(bill.rows[4].kwh, null);
  assert.equal(bill.rows[4].errors.length, 1);
});

test('lista de aparelhos com valores aproximados', () => {
  const byName = Object.fromEntries(PRESETS.map((p) => [p.name, p]));
  assert.equal(PRESETS.length, 22);
  assert.equal(byName['Chuveiro elétrico'].watts, 5500);
  assert.equal(byName['Geladeira frost free'].kwhMonth, 45);
  assert.equal(byName.Freezer.kwhMonth, 40);
  assert.equal(byName['PC gamer'].watts, 400);
  assert.deepEqual(fromPreset(byName['Geladeira frost free']), { name: 'Geladeira frost free', mode: 'kwh', watts: '', kwhMonth: '45', time: '', days: '', qty: '1' });
  assert.equal(fromPreset(byName['Chuveiro elétrico']).time, '0:40');
  for (const p of PRESETS) assert.equal(applianceKwh(fromPreset(p)).errors.length, 0, p.name);
});

test('formatação', () => {
  assert.equal(formatNumber(1234.567, 1), '1.234,6');
  assert.equal(formatBRL(0.005), 'R$ 0,01');
  assert.equal(formatBRL(1234.5), 'R$ 1.234,50');
});

test('CSV com ponto e vírgula, vírgula decimal e escape', () => {
  assert.equal(csvField('simples'), 'simples');
  assert.equal(csvField('a;b'), '"a;b"');
  assert.equal(csvField('TV 43"'), '"TV 43"""');
  assert.equal(csvField('linha\nquebrada'), '"linha\nquebrada"');
  assert.equal(csvField('=SOMA(A1:A2)'), "'=SOMA(A1:A2)");
  assert.equal(csvField('-1'), "'-1");

  const appliances = [{ ...tv, name: 'TV 43"; sala' }, fridge];
  const bill = computeBill({ appliances, tariff: '0,95', flag: '' });
  const lines = toCSV(appliances, bill).split('\r\n');
  assert.equal(lines[0], 'Aparelho;Potência (W);Consumo informado (kWh/mês);Tempo por dia;Dias por mês;Quantidade;kWh/mês;R$/mês;Participação (%)');
  assert.equal(lines[1], '"TV 43""; sala";80;;5:00;30;1;12,00;11,40;21,1');
  assert.equal(lines[2], 'Geladeira;;45;;;1;45,00;42,75;78,9');
  assert.equal(lines[3], 'Total;;;;;;57,00;54,15;100,0');
  assert.equal(lines[4], '');
});
