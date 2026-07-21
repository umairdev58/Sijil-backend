const { parseDateRange } = require('../nlp/dates');
const { help, moduleHelp } = require('./help');
const {
  listSales,
  getSale,
  salesStatistics,
  salesPeriodSummary,
  recentPayments,
  paymentHistory,
  customerOutstanding,
  overdueReceivables
} = require('./sales');
const directories = require('./directories');
const { handlePurchases } = require('./purchases');
const { handleLedger } = require('./dailyLedger');
const { handleInvoiceModule } = require('./invoiceModules');
const { handleContainerStatements } = require('./containerStatements');
const { handleDashboard, pendingInvoices } = require('./dashboard');

const handlers = {
  help,
  'help.module': moduleHelp,
  'dashboard.summary': handleDashboard,
  'dashboard.monthly': handleDashboard,
  'dashboard.top_outstanding': handleDashboard,
  'receivables.customer_outstanding': customerOutstanding,
  'receivables.all_outstanding': customerOutstanding,
  'receivables.overdue': overdueReceivables,
  'sales.list': listSales,
  'sales.recent': listSales,
  'sales.by_status': listSales,
  'sales.by_customer': listSales,
  'sales.by_container': listSales,
  'sales.by_invoice': getSale,
  'sales.statistics': salesStatistics,
  'sales.monthly': salesPeriodSummary,
  'sales.report_summary': salesPeriodSummary,
  'sales.recent_payments': recentPayments,
  'sales.payment_history': paymentHistory,
  'payments.recent': recentPayments,
  'customers.get': directories.customers,
  'customers.search': directories.customers,
  'customers.stats': directories.customers,
  'suppliers.get': directories.suppliers,
  'suppliers.search': directories.suppliers,
  'suppliers.stats': directories.suppliers,
  'products.list': directories.products,
  'products.search': directories.products,
  'products.by_category': directories.products,
  'products.stats': directories.products,
  'categories.list': directories.categories,
  'categories.search': directories.categories,
  'categories.stats': directories.categories,
  'purchases.list': handlePurchases,
  'purchases.get': handlePurchases,
  'purchases.by_container': handlePurchases,
  'purchases.report_summary': handlePurchases,
  'ledger.today': handleLedger,
  'ledger.by_date': handleLedger,
  'ledger.summary': handleLedger,
  'ledger.cash_position': handleLedger,
  'container.list': handleContainerStatements,
  'container.get': handleContainerStatements,
  'container.summary': handleContainerStatements,
  'invoices.pending': pendingInvoices
};

const invoiceDomains = ['freight', 'transport', 'dubaiTransport', 'dubaiClearance'];
invoiceDomains.forEach((domain) => {
  ['list', 'get', 'stats', 'by_status', 'payments', 'by_container', 'by_agent'].forEach((action) => {
    handlers[`${domain}.${action}`] = (context) => handleInvoiceModule(context, domain);
  });
});

const executeCommand = async (parsed) => {
  if (parsed.mode && parsed.mode !== 'read') {
    throw new Error(`Command mode '${parsed.mode}' is not permitted`);
  }
  const handler = handlers[parsed.intent];
  if (!handler) return null;

  const context = { ...parsed, entities: { ...parsed.entities } };
  if (
    ['sales.monthly', 'dashboard.monthly'].includes(parsed.intent)
    && !context.entities.dateRange
  ) {
    context.entities.dateRange = parseDateRange('this month');
  }
  return handler(context);
};

module.exports = { executeCommand, handlers };
