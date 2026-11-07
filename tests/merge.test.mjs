// Sync merge rules: last writer wins per record, and per line inside an order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const fresh = () => {
  const { Store } = load(['js/core/version.js', 'js/core/util.js', 'js/core/store.js']);
  return { Store };
};

const order = (lines, at = 100, by = 'a') => ({ id: 'o1', tableId: 't1', status: 'open', createdAt: 1, updatedAt: at, updatedBy: by, lines, payments: [], discount: { type: 'amt', value: 0 }, kotSeq: 1 });
const ln = (id, status, at, by = 'a') => ({ id, itemId: 'x', name: id, price: 100, qty: 1, status, addedAt: 1, updatedAt: at, updatedBy: by });

test('waiter adds a dish while the kitchen marks another ready: both survive', () => {
  const { Store } = fresh();
  const base = order([ln('l1', 'sent', 10)], 10);
  const kitchen = order([ln('l1', 'ready', 20, 'k')], 20, 'k');
  const waiter = order([ln('l1', 'sent', 10), ln('l2', 'sent', 15, 'w')], 15, 'w');
  let { rec } = Store._mergeOrder(base, kitchen);
  ({ rec } = Store._mergeOrder(rec, waiter));
  assert.equal(rec.lines.find((l) => l.id === 'l1').status, 'ready');
  assert.ok(rec.lines.find((l) => l.id === 'l2'));
});

test('merge is order-independent (same result either way round)', () => {
  const { Store } = fresh();
  const a = order([ln('l1', 'ready', 20, 'k')], 20, 'k');
  const b = order([ln('l1', 'sent', 10), ln('l2', 'draft', 15, 'w')], 15, 'w');
  const ab = Store._mergeOrder(a, b).rec; const ba = Store._mergeOrder(b, a).rec;
  assert.deepEqual(JSON.parse(JSON.stringify(ab.lines)), JSON.parse(JSON.stringify(ba.lines)));
  assert.equal(ab.updatedAt, ba.updatedAt);
});

test('older copies never overwrite newer ones', () => {
  const { Store } = fresh();
  const now = order([ln('l1', 'served', 30)], 30);
  const old = order([ln('l1', 'sent', 10)], 10);
  const { rec, changed } = Store._mergeOrder(now, old);
  assert.equal(rec.lines[0].status, 'served');
  assert.equal(changed, false);
});

test('equal timestamps are broken by device id, deterministically', () => {
  const { Store } = fresh();
  assert.equal(Store._newer({ updatedAt: 5, updatedBy: 'b' }, { updatedAt: 5, updatedBy: 'a' }), true);
  assert.equal(Store._newer({ updatedAt: 5, updatedBy: 'a' }, { updatedAt: 5, updatedBy: 'b' }), false);
});

test('migrate fills defaults for every saved field', () => {
  const { Store } = fresh();
  const { sh, lo } = Store.migrate({ orders: { x: { id: 'x' } }, items: { i: { id: 'i' } } }, {});
  assert.equal(sh.settings.currency, 'QAR');
  assert.equal(sh.orders.x.lines.length, 0);
  assert.equal(sh.items.i.available, true);
  assert.equal(lo.role, 'solo');
  assert.ok(lo.deviceId && lo.deviceCode);
  assert.equal(lo.everLinked, false);
});
