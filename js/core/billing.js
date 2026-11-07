// Bill maths. Pure functions, no DOM, no store access, so tests can run them in Node.
// All amounts are integer minor units (e.g. fils). Rates are percentages (5 = 5%).
const Billing = (() => {
  const LIVE = (l) => l.status !== 'void' && l.status !== 'draft';

  // Group identical lines (same dish, price and note) for the bill and receipt.
  const groupLines = (lines) => {
    const map = new Map();
    for (const l of lines.filter(LIVE)) {
      const k = l.itemId + '|' + l.price + '|' + (l.note || '');
      const g = map.get(k) || { name: l.name, note: l.note || '', price: l.price, qty: 0, total: 0 };
      g.qty += l.qty;
      g.total += l.price * l.qty;
      map.set(k, g);
    }
    return [...map.values()];
  };

  /**
   * @param order    { lines, discount: {type:'pct'|'amt', value} }
   * @param settings { taxes:[{name, rate}], taxInclusive, serviceCharge }
   * Discount applies first, then service charge on the discounted amount,
   * then taxes on (discounted + service). Inclusive taxes are carved out of the total.
   */
  const calc = (order, settings) => {
    const lines = groupLines(order.lines || []);
    const subtotal = lines.reduce((s, l) => s + l.total, 0);

    const d = order.discount || { type: 'amt', value: 0 };
    let discount = d.type === 'pct'
      ? Math.round(subtotal * Math.min(100, Math.max(0, Number(d.value) || 0)) / 100)
      : Math.round(Number(d.value) || 0);
    discount = Math.min(discount, subtotal);

    const afterDiscount = subtotal - discount;
    const service = Math.round(afterDiscount * (Number(settings.serviceCharge) || 0) / 100);
    const base = afterDiscount + service;

    const taxes = (settings.taxes || []).filter((x) => Number(x.rate) > 0);
    const rateSum = taxes.reduce((s, x) => s + Number(x.rate), 0);
    let taxLines, total;
    if (settings.taxInclusive) {
      const net = rateSum ? base / (1 + rateSum / 100) : base;
      taxLines = taxes.map((x) => ({ name: x.name, rate: Number(x.rate), amount: Math.round(net * Number(x.rate) / 100) }));
      total = base;
    } else {
      taxLines = taxes.map((x) => ({ name: x.name, rate: Number(x.rate), amount: Math.round(base * Number(x.rate) / 100) }));
      total = base + taxLines.reduce((s, x) => s + x.amount, 0);
    }
    const taxTotal = taxLines.reduce((s, x) => s + x.amount, 0);

    const paid = (order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const due = Math.max(0, total - paid);
    const change = Math.max(0, paid - total);

    return { lines, subtotal, discount, service, taxLines, taxTotal, total, paid, due, change };
  };

  return { calc, groupLines };
})();
