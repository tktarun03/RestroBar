// Bill maths. Integer minor units throughout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const { Billing, Util } = load(['js/core/util.js', 'js/core/billing.js']);
const line = (price, qty, status = 'sent', extra = {}) => ({ itemId: 'i' + price, name: 'Dish ' + price, price, qty, status, ...extra });

test('discount, then service, then tax on top (exclusive)', () => {
  const b = Billing.calc({ lines: [line(1000, 2)], discount: { type: 'pct', value: 10 } }, { taxes: [{ name: 'VAT', rate: 5 }], serviceCharge: 10, taxInclusive: false });
  assert.equal(b.subtotal, 2000);
  assert.equal(b.discount, 200);
  assert.equal(b.service, 180);
  assert.equal(b.taxTotal, 99);
  assert.equal(b.total, 2079);
});

test('the e2e example: 2×38 + 5, service 10%, VAT 5% = 93.56', () => {
  const b = Billing.calc({ lines: [line(3800, 2), line(500, 1)] }, { taxes: [{ name: 'VAT', rate: 5 }], serviceCharge: 10 });
  assert.equal(b.subtotal, 8100); assert.equal(b.service, 810); assert.equal(b.taxTotal, 446); assert.equal(b.total, 9356);
});

test('inclusive tax is carved out, total unchanged', () => {
  const b = Billing.calc({ lines: [line(10500, 1)] }, { taxes: [{ name: 'VAT', rate: 5 }], taxInclusive: true });
  assert.equal(b.total, 10500);
  assert.equal(b.taxTotal, 500);
});

test('two taxes are each charged on the same base', () => {
  const b = Billing.calc({ lines: [line(10000, 1)] }, { taxes: [{ name: 'CGST', rate: 2.5 }, { name: 'SGST', rate: 2.5 }] });
  assert.deepEqual(b.taxLines.map((x) => x.amount), [250, 250]);
  assert.equal(b.total, 10500);
});

test('void and unsent dishes are not billed', () => {
  const b = Billing.calc({ lines: [line(1000, 1), line(2000, 1, 'void'), line(3000, 1, 'draft')] }, {});
  assert.equal(b.subtotal, 1000);
});

test('identical dishes group, different notes stay apart', () => {
  const g = Billing.groupLines([line(500, 1), line(500, 2), line(500, 1, 'sent', { note: 'no ice' })]);
  assert.equal(g.length, 2);
  assert.equal(g[0].qty, 3);
});

test('discount can never exceed the subtotal', () => {
  const b = Billing.calc({ lines: [line(1000, 1)], discount: { type: 'amt', value: 5000 } }, {});
  assert.equal(b.discount, 1000); assert.equal(b.total, 0);
});

test('payments: due and change', () => {
  const b = Billing.calc({ lines: [line(9356, 1)], payments: [{ method: 'cash', amount: 10000 }] }, {});
  assert.equal(b.due, 0); assert.equal(b.change, 644);
  const c = Billing.calc({ lines: [line(9356, 1)], payments: [{ method: 'card', amount: 5000 }] }, {});
  assert.equal(c.due, 4356); assert.equal(c.change, 0);
});

test('currency minor units: QAR 2, JPY 0, KWD 3', () => {
  assert.equal(Util.minorDigits('QAR'), 2);
  assert.equal(Util.minorDigits('JPY'), 0);
  assert.equal(Util.minorDigits('KWD'), 3);
  assert.equal(Util.toMinor(12.5, 'KWD'), 12500);
  assert.equal(Util.toMinor(0.1 + 0.2, 'QAR'), 30);
});

test('escaping user text before it goes into HTML', () => {
  assert.equal(Util.esc('<img src=x onerror="1">&\''), '&lt;img src=x onerror=&quot;1&quot;&gt;&amp;&#39;');
});

test('business day: a 1 am bill counts for the night before when the day ends at 4', () => {
  const at = (s) => new Date(s).getTime();
  assert.equal(Util.bizDay(at('2026-11-08T01:30:00'), 4), '2026-11-07');
  assert.equal(Util.bizDay(at('2026-11-08T04:30:00'), 4), '2026-11-08');
  assert.equal(Util.bizDay(at('2026-11-08T01:30:00'), 0), '2026-11-08');
});
