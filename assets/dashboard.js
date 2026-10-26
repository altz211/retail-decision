import {
  demoSales,
  validate,
  parseCSV,
  csv,
  sumSales,
  splitPeriods,
  marginChange,
  group,
  planOrder
} from './sales.js';
const $ = id => document.getElementById(id);
let data = [],
  plan = null,
  currency = 'AED';
const number = n => new Intl.NumberFormat('en', {
  maximumFractionDigits: 0
}).format(n);
const money = n => `${currency} ${number(n)}`;
const esc = x => String(x).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
const pct = n => `${(n*100).toFixed(1)}%`;

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], {
    type: 'text/csv;charset=utf-8'
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function load(input, source) {
  const checked = validate(input);
  data = checked.data;
  $('source').textContent = source;
  const stores = [...new Set(data.map(r => r.store))].sort();
  $('store').replaceChildren(new Option('All stores', ''), ...stores.map(s => new Option(s, s)));
  $('quality').textContent = `${number(data.length)} daily records · ${stores.length} stores · ${data[0].date} to ${data.at(-1).date} · ${checked.gaps?checked.gaps+' gaps in daily records':'No daily gaps within series'} · Stock dates can vary by SKU.`;
  $('error').textContent = '';
  render();
}

function render() {
  currency = $('currency').value;
  const selected = data.filter(r => !$('store').value || r.store === $('store').value);
  const periods = splitPeriods(selected),
    before = sumSales(periods.previous),
    current = sumSales(periods.current);
  const margin = current.revenue ? current.profit / current.revenue : 0;
  const delta = current.profit - before.profit;
  $('period').textContent = `Comparing two ${periods.days}-day periods`;
  $('metrics').innerHTML = [
    ['Net revenue', money(current.revenue), 'After discounts and returns'],
    ['Contribution', money(current.profit), `${delta>=0?'+':''}${money(delta)} vs previous`],
    ['Contribution margin', pct(margin), 'Before operating expenses'],
    ['Return rate', current.units ? pct(current.returns / current.units) : 'N/A', 'Returned units / gross units']
  ].map(([label, value, note]) => `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
  const storeTotals = [...group(periods.current, r => r.store)].map(([s, r]) => ({
    s,
    ...sumSales(r)
  }));
  const max = Math.max(...storeTotals.map(r => r.revenue), 1);
  $('stores').innerHTML = storeTotals.map(r => `<div class="bar-row"><div class="bar-label"><strong>${esc(r.s)}</strong><span>${money(r.revenue)} · ${r.revenue?pct(r.profit/r.revenue):'N/A'} margin</span></div><div class="bar-track"><div class="bar-fill" style="width:${100*r.revenue/max}%"></div></div></div>`).join('');
  const bridge = marginChange(periods.previous, periods.current);
  $('bridge').innerHTML = [
    ['Units sold', bridge.volume],
    ['Price / mix', bridge.priceMix],
    ['Cost / mix', bridge.costMix],
    ['Total change', bridge.delta]
  ].map(([label, value]) => `<div class="bridge-row"><span>${label}</span><strong class="${value<0?'negative':'positive'}">${value>0?'+':''}${money(value)}</strong></div>`).join('');
  const budget = Math.min(1e7, Math.max(0, Number($('budget').value) || 0));
  const buffer = Math.min(30, Math.max(0, Math.floor(Number($('buffer').value) || 0)));
  plan = planOrder(selected, budget, buffer, $('model').value);
  $('plan-summary').textContent = `${money(plan.spent)} allocated · ${money(plan.remaining)} unallocated · ${number(plan.lines.reduce((s,r)=>s+r.allocated,0))} units recommended`;
  $('plan').innerHTML = plan.lines.sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity)).map(r => `<tr><td><strong>${esc(r.store)}</strong><small>${esc(r.sku)} · ${esc(r.category)}</small></td><td>${number(r.inventory)}</td><td class="${r.days!==null&&r.days<r.lead?'negative':''}">${r.days===null?'N/A':r.days.toFixed(1)}</td><td>${number(r.needed)}</td><td><strong>${number(r.allocated)}</strong></td><td>${money(r.allocated*r.cost)}</td><td>${r.test?.wape!=null?pct(r.test.wape):'N/A'}</td></tr>`).join('');
}
for (const id of ['store', 'currency', 'model']) $(id).addEventListener('change', render);
for (const id of ['budget', 'buffer']) $(id).addEventListener('input', render);
$('reset').onclick = () => load(demoSales(), 'SYNTHETIC DEMO');
$('template').onclick = () => download(csv(demoSales()), 'retail-sample.csv');
$('export').onclick = () => download(csv(plan.lines.map(r => ({
  store: r.store,
  sku: r.sku,
  inventory: r.inventory,
  target_gap: r.needed,
  buy_units: r.allocated,
  purchase_cost: r.allocated * r.cost,
  currency
})), ['store', 'sku', 'inventory', 'target_gap', 'buy_units', 'purchase_cost', 'currency']), 'inventory-plan.csv');
$('upload').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error('Please use a CSV smaller than 5 MB.');
    load(parseCSV(await file.text()), 'LOCAL CSV');
  } catch (err) {
    $('error').textContent = err.message;
  } finally {
    e.target.value = '';
  }
};
load(demoSales(), 'SYNTHETIC DEMO');
