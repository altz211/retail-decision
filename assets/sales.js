export const columns = ['date', 'store', 'sku', 'category', 'units', 'unit_price', 'unit_cost', 'discount', 'returns', 'inventory', 'lead_days'];
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell === '') quoted = !quoted;
      else throw Error('Unexpected quote in CSV.');
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw Error('Unclosed quoted field.');
  row.push(cell);
  if (row.some(x => x.trim())) rows.push(row);
  if (!rows.length) throw Error('CSV is empty.');
  const headers = rows.shift().map(x => x.replace(/^\uFEFF/, '').trim());
  if (new Set(headers).size !== headers.length) throw Error('Duplicate column names.');
  for (const f of columns)
    if (!headers.includes(f)) throw Error(`Missing column: ${f}`);
  if (rows.length > 30000) throw Error('Please use at most 30,000 daily records.');
  return rows.map((r, i) => {
    if (r.length !== headers.length) throw Error(`CSV row ${i+2}: inconsistent column count.`);
    return Object.fromEntries(headers.map((history, j) => [history, r[j].trim()]));
  });
}
export function validate(input) {
  if (!input.length) throw Error('No records found.');
  const keys = new Set();
  const errors = [];
  let gaps = 0;
  const data = input.map((r, i) => {
    const x = {
      ...r
    };
    const fail = m => {
      if (errors.length < 8) errors.push(`Row ${i+2}: ${m}`);
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !Number.isFinite(Date.parse(x.date)) || new Date(x.date).toISOString().slice(0, 10) !== x.date) fail('date must be a valid YYYY-MM-DD.');
    for (const f of ['store', 'sku', 'category'])
      if (!String(x[f] ?? '').trim()) fail(`${f} is required.`);
    for (const f of columns.slice(4)) {
      if (x[f] === '' || x[f] == null) fail(`${f} is missing.`);
      x[f] = Number(x[f]);
      if (!Number.isFinite(x[f]) || x[f] < 0) fail(`${f} must be nonnegative and finite.`);
    }
    for (const f of ['units', 'returns', 'inventory', 'lead_days'])
      if (!Number.isInteger(x[f])) fail(`${f} must be an integer.`);
    if (x.returns > x.units) fail('returns exceed units.');
    if (x.discount > x.units * x.unit_price) fail('discount exceeds gross sales.');
    if (x.lead_days > 90) fail('lead_days exceeds 90-day demo limit.');
    const key = [x.date, x.store, x.sku].join('|');
    if (keys.has(key)) fail('duplicate date/store/SKU.');
    keys.add(key);
    return x;
  });
  if (errors.length) throw Error(errors.join('\n'));
  const groups = group(data, r => `${r.store}|${r.sku}`);
  for (const list of groups.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < list.length; i++)
      if ((Date.parse(list[i].date) - Date.parse(list[i - 1].date)) / 864e5 !== 1) gaps++;
  }
  return {
    data: data.sort((a, b) => a.date.localeCompare(b.date)),
    gaps
  };
}
export function group(data, key) {
  const m = new Map();
  for (const r of data) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}
export function saleAmounts(r) {
  const retained = r.units - r.returns;
  const netPrice = r.units ? r.unit_price - r.discount / r.units : r.unit_price;
  const revenue = retained * netPrice,
    cost = retained * r.unit_cost;
  return {
    revenue,
    cost,
    profit: revenue - cost,
    units: r.units,
    returns: r.returns
  };
}
export function sumSales(data) {
  return data.reduce((a, r) => {
    const f = saleAmounts(r);
    for (const k in a) a[k] += f[k];
    return a;
  }, {
    revenue: 0,
    cost: 0,
    profit: 0,
    units: 0,
    returns: 0
  });
}
export function splitPeriods(data) {
  const dates = [...new Set(data.map(r => r.date))].sort();
  const n = Math.floor(dates.length / 2);
  if (!n) return {
    previous: [],
    current: data,
    days: dates.length
  };
  const selected = dates.slice(-2 * n),
    cut = selected[n];
  return {
    previous: data.filter(r => r.date >= selected[0] && r.date < cut),
    current: data.filter(r => r.date >= cut),
    days: n
  };
}
export function marginChange(previous, current) {
  const a = sumSales(previous),
    b = sumSales(current);
  const unitsBefore = a.units - a.returns,
    unitsNow = b.units - b.returns,
    priceBefore = unitsBefore ? a.revenue / unitsBefore : 0,
    priceNow = unitsNow ? b.revenue / unitsNow : 0,
    costBefore = unitsBefore ? a.cost / unitsBefore : 0,
    costNow = unitsNow ? b.cost / unitsNow : 0;
  return {
    volume: (unitsNow - unitsBefore) * (priceBefore - costBefore),
    priceMix: unitsNow * (priceNow - priceBefore),
    costMix: -unitsNow * (costNow - costBefore),
    delta: b.profit - a.profit
  };
}
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export function forecast(history, horizon = 7, method = 'weekday') {
  const recent = history.slice(-28),
    avg = mean(recent.map(r => r.units));
  return Array.from({
    length: horizon
  }, (_, i) => {
    const date = new Date(Date.parse(history.at(-1).date) + (i + 1) * 864e5);
    const matches = recent.filter(r => new Date(r.date).getUTCDay() === date.getUTCDay());
    return {
      date: date.toISOString().slice(0, 10),
      units: method === 'weekday' && matches.length ? mean(matches.map(r => r.units)) : avg
    };
  });
}
export function backtest(history, method = 'weekday') {
  if (history.length < 35) return null;
  let totalError = 0,
    actual = 0,
    n = 0;
  for (let i = Math.max(28, history.length - 28); i < history.length; i++) {
    const prediction = forecast(history.slice(0, i), 1, method)[0].units;
    totalError += Math.abs(prediction - history[i].units);
    actual += history[i].units;
    n++;
  }
  return {
    mae: totalError / n,
    wape: actual ? totalError / actual : null,
    n
  };
}
export function planOrder(data, budget, buffer = 3, method = 'weekday') {
  const lines = [];
  for (const rows of group(data, r => `${r.store}|${r.sku}`).values()) {
    const history = [...rows].sort((a, b) => a.date.localeCompare(b.date)),
      last = history.at(-1);
    const coverage = last.lead_days + buffer;
    const f = forecast(history, Math.max(coverage, 1), method);
    const expected = f.slice(0, coverage).reduce((s, r) => s + r.units, 0);
    const needed = Math.max(0, Math.ceil(expected - last.inventory));
    const daily = mean(f.map(r => r.units));
    const recent = history.slice(-28);
    const t = sumSales(recent);
    const retained = t.units - t.returns;
    const margin = retained ? t.profit / retained : 0;
    lines.push({
      store: last.store,
      sku: last.sku,
      category: last.category,
      inventory: last.inventory,
      daily,
      needed,
      cost: last.unit_cost,
      margin,
      days: daily ? last.inventory / daily : null,
      lead: last.lead_days,
      allocated: 0,
      history: history,
      test: backtest(history, method)
    });
  }
  // Spend on higher margin per dirham first; break ties with stock cover.
  const ranked = lines.filter(r => r.cost > 0 && r.margin > 0).sort((a, b) => (b.margin / b.cost - a.margin / a.cost) || ((a.days ?? Infinity) - (b.days ?? Infinity)) || a.sku.localeCompare(b.sku));
  let remaining = budget;
  for (const r of ranked) {
    r.allocated = Math.min(r.needed, Math.floor((remaining + 1e-8) / r.cost));
    remaining = Math.max(0, remaining - r.allocated * r.cost);
  }
  return {
    lines,
    spent: budget - remaining,
    remaining
  };
}
export function demoSales() {
  let seed = 2169;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const items = [
    ['G101', 'Specialty coffee', 42, 25],
    ['G102', 'Dates selection', 32, 18],
    ['G103', 'Olive oil', 55, 36],
    ['H201', 'Laundry essentials', 28, 19],
    ['H202', 'Kitchen essentials', 65, 43],
    ['H203', 'Personal care', 38, 22]
  ];
  const stores = ['Dubai Marina', 'Abu Dhabi Central', 'Sharjah City'];
  const rows = [];
  for (let d = 0; d < 84; d++) {
    const date = new Date(Date.UTC(2026, 5, 1 + d)).toISOString().slice(0, 10);
    for (let s = 0; s < stores.length; s++)
      for (let j = 0; j < items.length; j++) {
        const [sku, category, price, cost] = items[j];
        const weekend = [0, 6].includes(new Date(date).getUTCDay());
        const units = Math.max(0, Math.round(7 + j * 2 + s * 2 + (weekend ? 5 : 0) + random() * 8 + (d >= 42 ? 3 : 0)));
        const discount = units * price * (d >= 42 && j < 2 ? .26 : .04);
        rows.push({
          date,
          store: stores[s],
          sku,
          category,
          units,
          unit_price: price,
          unit_cost: cost + (d >= 42 && j < 2 ? 5 : 0),
          discount: +discount.toFixed(2),
          returns: random() < .18 ? 2 : 0,
          inventory: Math.round((j % 3 === 0 ? 1 : 4) * units + random() * 15),
          lead_days: 3 + j % 3
        });
      }
  }
  return rows;
}
export function csv(rows, fields = columns) {
  const escape = x => '"' + String(x ?? '').replaceAll('"', '""') + '"';
  return [fields.join(','), ...rows.map(r => fields.map(f => escape(r[f])).join(','))].join('\n');
}
