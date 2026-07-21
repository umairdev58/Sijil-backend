const Sales = require('../../../models/Sales');
const Payment = require('../../../models/Payment');
const { heading, money, date, status, limitedList } = require('../formatter');
const { escapeRegex, dateFilter, sum } = require('./helpers');

const saleLine = (sale) => (
  `• *${sale.invoiceNumber}* — ${sale.customer}\n` +
  `  ${money(sale.amount)} | ${status(sale.status)} | Due ${date(sale.dueDate)}`
);

const listSales = async ({ entities, intent }) => {
  const query = { ...dateFilter('invoiceDate', entities.dateRange) };
  if (intent === 'sales.by_status') {
    query.status = entities.status === 'pending'
      ? { $in: ['unpaid', 'partially_paid', 'overdue'] }
      : entities.status || 'unpaid';
  }
  if (intent === 'sales.by_customer') {
    query.customer = { $regex: escapeRegex(entities.customerName), $options: 'i' };
  }
  if (intent === 'sales.by_container') {
    query.containerNo = { $regex: `^${escapeRegex(entities.containerNo)}$`, $options: 'i' };
  }

  const total = await Sales.countDocuments(query);
  const sales = await Sales.find(query).sort({ invoiceDate: -1 }).limit(entities.limit).lean();
  const title = intent === 'sales.by_status'
    ? `${entities.status === 'pending' ? 'Pending' : status(entities.status || 'unpaid')} sales`
    : `Sales${entities.dateRange?.label ? ` — ${entities.dateRange.label}` : ''}`;
  return `${heading(title)}\n${limitedList(sales, saleLine, total, entities.limit)}`;
};

const getSale = async ({ entities }) => {
  const sale = await Sales.findOne({
    invoiceNumber: { $regex: `^${escapeRegex(entities.invoiceNumber)}$`, $options: 'i' }
  }).lean();
  if (!sale) return `No sale invoice matching *${entities.invoiceNumber}* was found.`;
  return [
    heading(`Sale ${sale.invoiceNumber}`),
    `Customer: ${sale.customer}`,
    `Supplier: ${sale.supplier}`,
    `Container: ${sale.containerNo}`,
    `Product: ${sale.product}`,
    `Quantity: ${sale.quantity}`,
    `Amount: ${money(sale.amount)}`,
    `Received: ${money(sale.receivedAmount)}`,
    `Outstanding: ${money(sale.outstandingAmount)}`,
    `Status: ${status(sale.status)}`,
    `Invoice date: ${date(sale.invoiceDate)}`,
    `Due date: ${date(sale.dueDate)}`
  ].join('\n');
};

const salesStatistics = async () => {
  const stats = await Sales.getStatistics();
  return [
    heading('Sales summary'),
    `Total sales: ${money(stats.totalSales)}`,
    `Received: ${money(stats.totalReceived)}`,
    `Outstanding: ${money(stats.totalOutstanding)}`,
    `Invoices: ${stats.totalCount}`,
    `Paid: ${stats.paidCount}`,
    `Partially paid: ${stats.partiallyPaidCount}`,
    `Unpaid: ${stats.unpaidCount}`,
    `Overdue: ${stats.overdueCount}`
  ].join('\n');
};

const salesPeriodSummary = async ({ entities }) => {
  const query = { ...dateFilter('invoiceDate', entities.dateRange) };
  const sales = await Sales.find(query).lean();
  const label = entities.dateRange?.label || 'all time';
  return [
    heading(`Sales — ${label}`),
    `Invoices: ${sales.length}`,
    `Sales: ${money(sum(sales, 'amount'))}`,
    `Received: ${money(sum(sales, 'receivedAmount'))}`,
    `Outstanding: ${money(sum(sales, 'outstandingAmount'))}`,
    `Overdue: ${sales.filter((sale) => sale.status === 'overdue').length}`
  ].join('\n');
};

const recentPayments = async ({ entities }) => {
  const query = { ...dateFilter('paymentDate', entities.dateRange) };
  const total = await Payment.countDocuments(query);
  const payments = await Payment.find(query)
    .populate('saleId', 'invoiceNumber customer')
    .sort({ paymentDate: -1 })
    .limit(entities.limit)
    .lean();
  return `${heading('Recent sales payments')}\n${limitedList(payments, (payment) => (
    `• ${money(payment.amount)} — ${payment.saleId?.invoiceNumber || 'Invoice unavailable'}\n` +
    `  ${payment.saleId?.customer || ''} | ${date(payment.paymentDate)} | ${String(payment.paymentMethod || '').replace(/_/g, ' ')}`
  ), total, entities.limit)}`;
};

const paymentHistory = async ({ entities }) => {
  const sale = await Sales.findOne({
    invoiceNumber: { $regex: `^${escapeRegex(entities.invoiceNumber)}$`, $options: 'i' }
  });
  if (!sale) return `No sale invoice matching *${entities.invoiceNumber}* was found.`;
  const payments = await Payment.find({ saleId: sale._id }).sort({ paymentDate: -1 }).lean();
  return `${heading(`Payments — ${sale.invoiceNumber}`)}\n${limitedList(payments, (payment) => (
    `• ${money(payment.amount)} — ${date(payment.paymentDate)}\n` +
    `  ${String(payment.paymentMethod || '').replace(/_/g, ' ')}${payment.reference ? ` | ${payment.reference}` : ''}`
  ))}`;
};

const customerOutstanding = async ({ entities }) => {
  const match = { outstandingAmount: { $gt: 0 } };
  if (entities.customerName) {
    match.customer = { $regex: escapeRegex(entities.customerName), $options: 'i' };
  }
  const rows = await Sales.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$customer',
        invoices: { $sum: 1 },
        outstanding: { $sum: '$outstandingAmount' },
        overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } }
      }
    },
    { $sort: { outstanding: -1 } },
    { $limit: entities.limit || 10 }
  ]);
  const title = entities.customerName
    ? `Outstanding — ${entities.customerName}`
    : 'Customer outstanding';
  return `${heading(title)}\n${limitedList(rows, (row) => (
    `• *${row._id}*: ${money(row.outstanding)}\n  ${row.invoices} invoice(s), ${row.overdue} overdue`
  ))}`;
};

const overdueReceivables = async ({ entities }) => listSales({
  entities: { ...entities, status: 'overdue' },
  intent: 'sales.by_status'
});

module.exports = {
  listSales,
  getSale,
  salesStatistics,
  salesPeriodSummary,
  recentPayments,
  paymentHistory,
  customerOutstanding,
  overdueReceivables
};
