const { heading } = require('../formatter');

const sections = {
  sales: [
    'sales today',
    'sales for customer Ahmed',
    'sales invoice INV-100',
    'overdue sales',
    'recent payments',
    'outstanding for customer Ahmed'
  ],
  customers: ['customer Ahmed', 'find customer Ahmed', 'customer statistics'],
  suppliers: ['supplier Ali Trading', 'find supplier Ali', 'supplier statistics'],
  products: ['list products', 'find product apple', 'products category Fruits'],
  purchases: ['recent purchases', 'purchase container ABC123', 'purchase report this month'],
  ledger: ['ledger today', 'ledger 21/07/2026', 'ledger summary this month', 'cash position today'],
  freight: ['freight invoices', 'freight invoice FR-100', 'overdue freight', 'freight stats'],
  transport: ['transport invoices', 'transport invoice TR-100', 'transport agent Ahmed'],
  clearance: ['dubai clearance invoices', 'clearance invoice DC-100', 'clearance stats'],
  container: ['container statement ABC123', 'container summary ABC123', 'recent container statements']
};

const help = async () => [
  heading('Sijil Record Assistant'),
  'Ask for read-only information using natural language.',
  '',
  '*Sales & receivables*',
  '• sales today',
  '• sales invoice INV-100',
  '• outstanding for customer Ahmed',
  '• recent payments',
  '',
  '*Operations*',
  '• purchase container ABC123',
  '• ledger today',
  '• freight stats',
  '• transport agent Ahmed',
  '• container summary ABC123',
  '',
  '*Directories*',
  '• find customer Ahmed',
  '• list products',
  '• supplier statistics',
  '',
  'Type *help sales* or *help ledger* for more examples.'
].join('\n');

const moduleHelp = async ({ entities }) => {
  const requested = String(entities.module || '').toLowerCase();
  const key = Object.keys(sections).find((name) => requested.includes(name));
  if (!key) return help();
  return [
    heading(`${key.charAt(0).toUpperCase()}${key.slice(1)} commands`),
    ...sections[key].map((example) => `• ${example}`)
  ].join('\n');
};

module.exports = { help, moduleHelp };
