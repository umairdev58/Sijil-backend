const FreightInvoice = require('../../../models/FreightInvoice');
const FreightPayment = require('../../../models/FreightPayment');
const TransportInvoice = require('../../../models/TransportInvoice');
const TransportPayment = require('../../../models/TransportPayment');
const DubaiTransportInvoice = require('../../../models/DubaiTransportInvoice');
const DubaiTransportPayment = require('../../../models/DubaiTransportPayment');
const DubaiClearanceInvoice = require('../../../models/DubaiClearanceInvoice');
const DubaiClearancePayment = require('../../../models/DubaiClearancePayment');
const { heading, money, date, status, limitedList } = require('../formatter');
const { escapeRegex, dateFilter } = require('./helpers');

const configs = {
  freight: {
    label: 'Freight',
    Model: FreightInvoice,
    Payment: FreightPayment,
    paymentField: 'freightInvoiceId',
    amountField: 'amount_aed',
    paidField: 'paid_amount_aed',
    outstandingField: 'outstanding_amount_aed',
    currency: 'AED',
    containerField: 'container_number'
  },
  transport: {
    label: 'Transport',
    Model: TransportInvoice,
    Payment: TransportPayment,
    paymentField: 'transportInvoiceId',
    amountField: 'amount_pkr',
    paidField: 'paid_amount_pkr',
    outstandingField: 'outstanding_amount_pkr',
    currency: 'PKR',
    agentField: 'agent'
  },
  dubaiTransport: {
    label: 'Dubai transport',
    Model: DubaiTransportInvoice,
    Payment: DubaiTransportPayment,
    paymentField: 'invoiceId',
    amountField: 'amount_aed',
    paidField: 'paid_amount_aed',
    outstandingField: 'outstanding_amount_aed',
    currency: 'AED',
    containerField: 'container_number'
  },
  dubaiClearance: {
    label: 'Dubai clearance',
    Model: DubaiClearanceInvoice,
    Payment: DubaiClearancePayment,
    paymentField: 'invoiceId',
    amountField: 'amount_aed',
    paidField: 'paid_amount_aed',
    outstandingField: 'outstanding_amount_aed',
    currency: 'AED',
    agentField: 'agent'
  }
};

const invoiceLine = (invoice, config) => (
  `• *${invoice.invoice_number}* — ${money(invoice[config.amountField], config.currency)}\n` +
  `  ${status(invoice.status)} | Outstanding ${money(invoice[config.outstandingField], config.currency)} | Due ${date(invoice.due_date)}`
);

const buildQuery = (config, entities, action) => {
  const query = { ...dateFilter('invoice_date', entities.dateRange) };
  if (action === 'get' || action === 'payments') {
    query.invoice_number = { $regex: `^${escapeRegex(entities.invoiceNumber)}$`, $options: 'i' };
  }
  if (action === 'status') {
    query.status = entities.status === 'pending'
      ? { $in: ['unpaid', 'partially_paid', 'overdue'] }
      : entities.status || 'unpaid';
  }
  if (action === 'container' && config.containerField) {
    query[config.containerField] = { $regex: escapeRegex(entities.containerNo), $options: 'i' };
  }
  if (action === 'agent' && config.agentField) {
    query[config.agentField] = { $regex: escapeRegex(entities.agent), $options: 'i' };
  }
  return query;
};

const handleInvoiceModule = async ({ entities, intent }, moduleName) => {
  const config = configs[moduleName];
  const action = intent.split('.').pop().replace('by_', '');
  const query = buildQuery(config, entities, action);

  if (action === 'stats') {
    const stats = await config.Model.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          invoices: { $sum: 1 },
          total: { $sum: `$${config.amountField}` },
          paid: { $sum: `$${config.paidField}` },
          outstanding: { $sum: `$${config.outstandingField}` },
          overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } }
        }
      }
    ]);
    const row = stats[0] || { invoices: 0, total: 0, paid: 0, outstanding: 0, overdue: 0 };
    return [
      heading(`${config.label} summary`),
      `Invoices: ${row.invoices}`,
      `Total: ${money(row.total, config.currency)}`,
      `Paid: ${money(row.paid, config.currency)}`,
      `Outstanding: ${money(row.outstanding, config.currency)}`,
      `Overdue: ${row.overdue}`
    ].join('\n');
  }

  const invoice = ['get', 'payments'].includes(action)
    ? await config.Model.findOne(query).lean()
    : null;
  if (['get', 'payments'].includes(action) && !invoice) {
    return `No ${config.label.toLowerCase()} invoice matching *${entities.invoiceNumber}* was found.`;
  }

  if (action === 'payments') {
    const payments = await config.Payment.find({ [config.paymentField]: invoice._id })
      .sort({ paymentDate: -1 })
      .lean();
    return `${heading(`${config.label} payments — ${invoice.invoice_number}`)}\n${limitedList(payments, (payment) => (
      `• ${money(payment.amount, config.currency)} — ${date(payment.paymentDate)}\n` +
      `  ${String(payment.paymentMethod || '').replace(/_/g, ' ')}${payment.reference ? ` | ${payment.reference}` : ''}`
    ))}`;
  }

  if (action === 'get') {
    return [
      heading(`${config.label} — ${invoice.invoice_number}`),
      config.containerField ? `Container: ${invoice[config.containerField] || '—'}` : null,
      config.agentField ? `Agent: ${invoice[config.agentField] || '—'}` : null,
      `Amount: ${money(invoice[config.amountField], config.currency)}`,
      `Paid: ${money(invoice[config.paidField], config.currency)}`,
      `Outstanding: ${money(invoice[config.outstandingField], config.currency)}`,
      `Status: ${status(invoice.status)}`,
      `Invoice date: ${date(invoice.invoice_date)}`,
      `Due date: ${date(invoice.due_date)}`
    ].filter(Boolean).join('\n');
  }

  const total = await config.Model.countDocuments(query);
  const rows = await config.Model.find(query).sort({ invoice_date: -1 }).limit(entities.limit).lean();
  return `${heading(`${config.label} invoices`)}\n${limitedList(
    rows,
    (row) => invoiceLine(row, config),
    total,
    entities.limit
  )}`;
};

module.exports = { handleInvoiceModule };
