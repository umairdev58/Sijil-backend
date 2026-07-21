const Sales = require('../../../models/Sales');
const FreightInvoice = require('../../../models/FreightInvoice');
const TransportInvoice = require('../../../models/TransportInvoice');
const DubaiTransportInvoice = require('../../../models/DubaiTransportInvoice');
const DubaiClearanceInvoice = require('../../../models/DubaiClearanceInvoice');
const { heading, money, status, date, limitedList } = require('../formatter');
const { customerOutstanding, salesPeriodSummary } = require('./sales');

const dashboardSummary = async () => {
  const stats = await Sales.getStatistics();
  const operational = await Promise.all([
    FreightInvoice.countDocuments({ status: { $in: ['unpaid', 'partially_paid', 'overdue'] } }),
    TransportInvoice.countDocuments({ status: { $in: ['unpaid', 'partially_paid', 'overdue'] } }),
    DubaiTransportInvoice.countDocuments({ status: { $in: ['unpaid', 'partially_paid', 'overdue'] } }),
    DubaiClearanceInvoice.countDocuments({ status: { $in: ['unpaid', 'partially_paid', 'overdue'] } })
  ]);
  return [
    heading('Business overview'),
    `Sales: ${money(stats.totalSales)}`,
    `Received: ${money(stats.totalReceived)}`,
    `Sales outstanding: ${money(stats.totalOutstanding)}`,
    `Sales invoices: ${stats.totalCount}`,
    `Overdue sales: ${stats.overdueCount}`,
    '',
    heading('Open operational invoices'),
    `Freight: ${operational[0]}`,
    `Transport: ${operational[1]}`,
    `Dubai transport: ${operational[2]}`,
    `Dubai clearance: ${operational[3]}`
  ].join('\n');
};

const pendingInvoices = async ({ entities }) => {
  const query = { status: { $in: ['unpaid', 'partially_paid', 'overdue'] } };
  const summarize = async (Model, field) => {
    const rows = await Model.aggregate([
      { $match: query },
      { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: `$${field}` } } }
    ]);
    return rows[0] || { count: 0, outstanding: 0 };
  };
  const [salesSummary, freight, transport, dubaiTransport, clearance, sales] = await Promise.all([
    summarize(Sales, 'outstandingAmount'),
    summarize(FreightInvoice, 'outstanding_amount_aed'),
    summarize(TransportInvoice, 'outstanding_amount_pkr'),
    summarize(DubaiTransportInvoice, 'outstanding_amount_aed'),
    summarize(DubaiClearanceInvoice, 'outstanding_amount_aed'),
    Sales.find(query).sort({ dueDate: 1 }).limit(entities.limit).lean()
  ]);
  return [
    heading('Pending invoices'),
    `Sales: ${salesSummary.count} | ${money(salesSummary.outstanding)}`,
    `Freight: ${freight.count} | ${money(freight.outstanding)}`,
    `Transport: ${transport.count} | ${money(transport.outstanding, 'PKR')}`,
    `Dubai transport: ${dubaiTransport.count} | ${money(dubaiTransport.outstanding)}`,
    `Dubai clearance: ${clearance.count} | ${money(clearance.outstanding)}`,
    '',
    heading('Next sales due'),
    limitedList(sales, (sale) => (
      `• *${sale.invoiceNumber}* — ${sale.customer}\n` +
      `  ${money(sale.outstandingAmount)} outstanding | ${status(sale.status)} | Due ${date(sale.dueDate)}`
    ))
  ].join('\n');
};

const handleDashboard = async (context) => {
  if (context.intent === 'dashboard.top_outstanding') return customerOutstanding(context);
  if (context.intent === 'dashboard.monthly') return salesPeriodSummary(context);
  return dashboardSummary();
};

module.exports = { handleDashboard, pendingInvoices };
