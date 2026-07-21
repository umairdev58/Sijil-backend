const Purchase = require('../../../models/Purchase');
const { heading, money, date, limitedList } = require('../formatter');
const { escapeRegex, dateFilter, sum } = require('./helpers');

const purchaseLine = (purchase) => (
  `• *${purchase.containerNo}* — ${purchase.product}\n` +
  `  ${purchase.quantity} units | ${money(purchase.totalPKR, 'PKR')} | ${money(purchase.totalAED)} | ${date(purchase.createdAt)}`
);

const handlePurchases = async ({ entities, intent }) => {
  const query = { ...dateFilter('createdAt', entities.dateRange) };
  if (['purchases.by_container', 'purchases.get'].includes(intent)) {
    query.containerNo = { $regex: `^${escapeRegex(entities.containerNo)}$`, $options: 'i' };
  }

  if (intent === 'purchases.report_summary') {
    const rows = await Purchase.find(query).lean();
    return [
      heading(`Purchase summary${entities.dateRange?.label ? ` — ${entities.dateRange.label}` : ''}`),
      `Purchases: ${rows.length}`,
      `Quantity: ${sum(rows, 'quantity')}`,
      `Total: ${money(sum(rows, 'totalPKR'), 'PKR')}`,
      `Total: ${money(sum(rows, 'totalAED'))}`,
      `Transport: ${money(sum(rows, 'transport'), 'PKR')}`,
      `Freight: ${money(sum(rows, 'freight'), 'PKR')}`
    ].join('\n');
  }

  const total = await Purchase.countDocuments(query);
  const rows = await Purchase.find(query).sort({ createdAt: -1 }).limit(entities.limit).lean();
  if (rows.length === 1 && ['purchases.by_container', 'purchases.get'].includes(intent)) {
    const purchase = rows[0];
    return [
      heading(`Purchase — ${purchase.containerNo}`),
      `Product: ${purchase.product}`,
      `Quantity: ${purchase.quantity}`,
      `Rate: ${money(purchase.rate, 'PKR')}`,
      `Subtotal: ${money(purchase.subtotalPKR, 'PKR')}`,
      `Transport: ${money(purchase.transport, 'PKR')}`,
      `Freight: ${money(purchase.freight, 'PKR')}`,
      `Total: ${money(purchase.totalPKR, 'PKR')}`,
      `AED total: ${money(purchase.totalAED)}`,
      `Transfer rate: ${purchase.transferRate}`
    ].join('\n');
  }
  return `${heading('Purchases')}\n${limitedList(rows, purchaseLine, total, entities.limit)}`;
};

module.exports = { handlePurchases };
