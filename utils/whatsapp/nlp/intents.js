const intent = (id, domain, action, keywords, options = {}) => ({
  id,
  mode: 'read',
  domain,
  action,
  keywords,
  synonyms: options.synonyms || [],
  patterns: options.patterns || [],
  requiredAny: options.requiredAny || [],
  requiresPattern: options.requiresPattern || false,
  requiredEntities: options.requiredEntities || [],
  priority: options.priority || 0,
  examples: options.examples || []
});

const invoiceModuleIntents = (domain, aliases, options = {}) => [
  intent(`${domain}.payments`, domain, 'payments', aliases, {
    requiredAny: ['payments', 'payment history'],
    patterns: [/\bpayments?\b.*\binvoice\b/i],
    requiredEntities: ['invoiceNumber'],
    priority: 4
  }),
  intent(`${domain}.by_container`, domain, 'container', aliases, {
    requiredAny: ['container'],
    requiredEntities: ['containerNo'],
    priority: 3
  }),
  intent(`${domain}.by_agent`, domain, 'agent', aliases, {
    requiredAny: ['agent'],
    requiredEntities: ['agent'],
    priority: 3
  }),
  intent(`${domain}.by_status`, domain, 'status', aliases, {
    requiredAny: ['status', 'overdue', 'unpaid', 'paid', 'pending'],
    synonyms: ['overdue', 'unpaid', 'paid', 'pending'],
    priority: 2
  }),
  intent(`${domain}.stats`, domain, 'stats', aliases, {
    requiredAny: ['statistics', 'stats', 'summary', 'totals'],
    synonyms: ['stats', 'summary', 'totals'],
    priority: 2
  }),
  intent(`${domain}.get`, domain, 'get', aliases, {
    patterns: [/\binvoice\b(?:\s+(?:number|no|#))?\s*[:#-]?\s+[a-z0-9][a-z0-9/_-]*/i],
    requiresPattern: true,
    requiredEntities: ['invoiceNumber'],
    priority: 1
  }),
  intent(`${domain}.list`, domain, 'list', aliases, {
    synonyms: ['list', 'recent', 'show', 'all']
  })
].filter((definition) => {
  if (definition.action === 'container' && !options.container) return false;
  if (definition.action === 'agent' && !options.agent) return false;
  return true;
});

const intents = [
  intent('help.module', 'help', 'module', [], {
    patterns: [/\bhelp\s+(sales|customers|suppliers|products|purchases|ledger|freight|transport|clearance|containers?)\b/i],
    priority: 10
  }),
  intent('help', 'help', 'list', ['help'], {
    synonyms: ['menu', 'commands', 'what can you do', 'start'],
    patterns: [/^(hi|hello|hey)$/i],
    priority: 5
  }),

  intent('dashboard.top_outstanding', 'dashboard', 'top_outstanding', ['outstanding'], {
    requiredAny: ['top', 'largest'],
    synonyms: ['top dues', 'largest receivables'],
    patterns: [/\btop\s+\d*\s*(outstanding|dues|receivables)/i],
    priority: 8
  }),
  intent('dashboard.monthly', 'dashboard', 'monthly', ['dashboard', 'month'], {
    synonyms: ['monthly kpi', 'monthly summary'],
    priority: 4
  }),
  intent('dashboard.summary', 'dashboard', 'summary', ['dashboard', 'overview', 'kpi', 'summary'], {
    synonyms: ['business summary', 'kpi', 'overview', 'financial summary'],
    patterns: [/^dashboard$/i]
  }),

  intent('receivables.customer_outstanding', 'receivables', 'customer', ['outstanding', 'customer'], {
    synonyms: ['customer dues', 'customer balance', 'receivable'],
    patterns: [/\b(outstanding|dues|balance)\s+(?:for|of)\s+(.+)/i],
    priority: 8
  }),
  intent('receivables.overdue', 'receivables', 'overdue', ['overdue'], {
    synonyms: ['late receivables', 'overdue sales'],
    priority: 5
  }),
  intent('receivables.all_outstanding', 'receivables', 'all', ['outstanding'], {
    synonyms: ['all dues', 'receivables', 'total outstanding'],
    priority: 3
  }),

  intent('sales.payment_history', 'sales', 'payments', ['sales', 'payments'], {
    requiredEntities: ['invoiceNumber'],
    priority: 6
  }),
  intent('sales.recent_payments', 'sales', 'recent_payments', ['payments', 'recent'], {
    synonyms: ['latest payments', 'payments received'],
    priority: 5
  }),
  intent('sales.by_invoice', 'sales', 'invoice', ['sales', 'invoice'], {
    requiredEntities: ['invoiceNumber'],
    priority: 5
  }),
  intent('sales.by_customer', 'sales', 'customer', ['sales', 'customer'], {
    requiredEntities: ['customerName'],
    priority: 4
  }),
  intent('sales.by_container', 'sales', 'container', ['sales', 'container'], {
    requiredEntities: ['containerNo'],
    priority: 4
  }),
  intent('sales.by_status', 'sales', 'status', ['sales', 'status'], {
    synonyms: ['paid sales', 'unpaid sales', 'overdue sales'],
    priority: 3
  }),
  intent('sales.monthly', 'sales', 'monthly', ['sales', 'month'], {
    synonyms: ['monthly sales', 'sales this month'],
    priority: 3
  }),
  intent('sales.report_summary', 'sales', 'report', ['sales', 'report'], {
    synonyms: ['sales summary'],
    priority: 2
  }),
  intent('sales.statistics', 'sales', 'stats', ['sales', 'statistics'], {
    synonyms: ['sales stats', 'sales totals'],
    priority: 2
  }),
  intent('sales.recent', 'sales', 'recent', ['sales', 'recent'], {
    synonyms: ['latest sales', 'new sales'],
    priority: 2
  }),
  intent('sales.list', 'sales', 'list', ['sales'], {
    synonyms: ['list sales', 'show sales']
  }),

  intent('customers.stats', 'customers', 'stats', ['customers', 'statistics'], {
    synonyms: ['customer stats', 'customer count'],
    priority: 3
  }),
  intent('customers.search', 'customers', 'search', ['customers', 'search'], {
    synonyms: ['find customer', 'lookup customer'],
    priority: 3
  }),
  intent('customers.get', 'customers', 'get', ['customer'], {
    requiredEntities: ['customerName']
  }),
  intent('suppliers.stats', 'suppliers', 'stats', ['suppliers', 'statistics'], {
    synonyms: ['supplier stats', 'supplier count'],
    priority: 3
  }),
  intent('suppliers.search', 'suppliers', 'search', ['suppliers', 'search'], {
    synonyms: ['find supplier', 'lookup supplier'],
    priority: 3
  }),
  intent('suppliers.get', 'suppliers', 'get', ['supplier'], {
    requiredEntities: ['supplierName']
  }),

  intent('products.by_category', 'products', 'category', ['products', 'category'], {
    requiredEntities: ['category'],
    priority: 4
  }),
  intent('products.stats', 'products', 'stats', ['products', 'statistics'], {
    synonyms: ['product stats', 'product count'],
    priority: 3
  }),
  intent('products.search', 'products', 'search', ['products', 'search'], {
    synonyms: ['find product', 'lookup product'],
    priority: 2
  }),
  intent('products.list', 'products', 'list', ['products'], {
    synonyms: ['product list', 'all products']
  }),
  intent('categories.stats', 'categories', 'stats', ['categories', 'statistics'], {
    synonyms: ['category stats', 'category count'],
    priority: 3
  }),
  intent('categories.search', 'categories', 'search', ['categories', 'search'], {
    synonyms: ['find category'],
    priority: 2
  }),
  intent('categories.list', 'categories', 'list', ['categories'], {
    synonyms: ['category list', 'all categories']
  }),

  intent('purchases.by_container', 'purchases', 'container', ['purchases', 'container'], {
    requiredEntities: ['containerNo'],
    priority: 5
  }),
  intent('purchases.report_summary', 'purchases', 'report', ['purchases', 'report'], {
    synonyms: ['purchase summary', 'purchase totals'],
    priority: 3
  }),
  intent('purchases.get', 'purchases', 'get', ['purchase', 'container'], {
    requiredEntities: ['containerNo'],
    priority: 2
  }),
  intent('purchases.list', 'purchases', 'list', ['purchases'], {
    synonyms: ['recent purchases', 'all purchases']
  }),

  intent('ledger.cash_position', 'ledger', 'cash', ['ledger', 'cash', 'bank', 'position'], {
    synonyms: ['cash position', 'bank position', 'closing cash'],
    priority: 5
  }),
  intent('ledger.summary', 'ledger', 'summary', ['ledger', 'summary'], {
    synonyms: ['cash bank summary', 'ledger totals'],
    priority: 3
  }),
  intent('ledger.today', 'ledger', 'today', ['ledger', 'today'], { priority: 3 }),
  intent('ledger.by_date', 'ledger', 'date', ['ledger'], {
    requiredEntities: ['dateRange']
  }),

  ...invoiceModuleIntents('freight', ['freight'], { container: true }),
  ...invoiceModuleIntents('transport', ['transport'], { agent: true }),
  ...invoiceModuleIntents('dubaiTransport', ['dubai transport'], { container: true }),
  ...invoiceModuleIntents('dubaiClearance', ['dubai clearance', 'clearance'], { agent: true }),

  intent('container.summary', 'container', 'summary', ['container', 'summary'], {
    requiredEntities: ['containerNo'],
    synonyms: ['container profit', 'container pnl', 'container net'],
    priority: 5
  }),
  intent('container.get', 'container', 'get', ['container', 'statement'], {
    requiredEntities: ['containerNo'],
    priority: 3
  }),
  intent('container.list', 'container', 'list', ['container', 'statements'], {
    synonyms: ['recent containers', 'list statements']
  }),

  intent('payments.recent', 'payments', 'recent', ['payments', 'recent'], {
    synonyms: ['latest payments', 'recent receipts']
  }),
  intent('invoices.pending', 'invoices', 'pending', ['pending', 'invoices'], {
    synonyms: ['open invoices', 'unsettled invoices', 'unpaid invoices', 'partially paid invoices']
  })
];

module.exports = intents;
