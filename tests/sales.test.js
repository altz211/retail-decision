import {
  test
} from 'node:test';
import assert from 'node:assert/strict';
import {
  demoSales,
  validate,
  parseCSV,
  csv,
  sumSales,
  splitPeriods,
  marginChange,
  planOrder,
  forecast,
  backtest
} from '../assets/sales.js';
test('deterministic sample roundtrips through CSV and validation', () => {
  const a = demoSales();
  assert.deepEqual(validate(parseCSV(csv(a))).data, validate(a).data);
  assert.equal(a.length, 1512);
  assert.equal(validate(a).gaps, 0);
});
test('bridge reconciles exactly to profit change', () => {
  const {
    previous,
    current
  } = splitPeriods(demoSales());
  const b = marginChange(previous, current);
  assert.ok(Math.abs(b.volume + b.priceMix + b.costMix - b.delta) < 1e-6);
  assert.equal(b.delta, sumSales(current).profit - sumSales(previous).profit);
});
test('allocation respects budget, integer units and target gaps', () => {
  for (const budget of [0, 1, 100, 12000, 100000]) {
    const p = planOrder(demoSales(), budget);
    assert.ok(p.spent <= budget + 1e-6);
    assert.ok(Math.abs(p.lines.reduce((s, r) => s + r.cost * r.allocated, 0) - p.spent) < 1e-6);
    for (const r of p.lines) {
      assert.ok(Number.isInteger(r.allocated));
      assert.ok(r.allocated >= 0 && r.allocated <= r.needed);
    }
  }
});
test('rejects duplicate keys, invalid dates and impossible returns', () => {
  const a = demoSales();
  assert.throws(() => validate([a[0], a[0]]), /duplicate/);
  assert.throws(() => validate([{
    ...a[0],
    date: '2026-02-30'
  }]), /valid/);
  assert.throws(() => validate([{
    ...a[0],
    returns: 10000
  }]), /returns/);
});
test('CSV handles quoted identifiers and rejects malformed records', () => {
  const r = {
    ...demoSales()[0],
    store: 'Store, "Central"'
  };
  assert.equal(parseCSV(csv([r]))[0].store, r.store);
  assert.throws(() => parseCSV('date,date\na,b'), /Duplicate/);
  assert.throws(() => parseCSV('"abc'), /Unclosed/);
});
test('constant daily sales are forecast without backtest error', () => {
  const h = Array.from({
    length: 60
  }, (_, i) => ({
    ...demoSales()[0],
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    units: 10
  }));
  assert.equal(forecast(h, 7).reduce((s, r) => s + r.units, 0), 70);
  assert.equal(backtest(h).wape, 0);
});
