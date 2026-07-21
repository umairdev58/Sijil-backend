const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMessage } = require('../utils/whatsapp/nlp/parser');

test('detects representative Sijil intents and entities', () => {
  const cases = [
    ['help', 'help'],
    ['sales today', 'sales.list'],
    ['sales invoice INV-100', 'sales.by_invoice'],
    ['outstanding for customer Ahmed', 'receivables.customer_outstanding'],
    ['find customer Ahmed', 'customers.search'],
    ['products category Fruits', 'products.by_category'],
    ['purchase container ABC123', 'purchases.by_container'],
    ['ledger today', 'ledger.today'],
    ['freight invoices', 'freight.list'],
    ['freight stats', 'freight.stats'],
    ['freight payments invoice FR-100', 'freight.payments'],
    ['transport agent Ahmed', 'transport.by_agent'],
    ['dubai clearance invoice DC-10', 'dubaiClearance.get'],
    ['dubai transport stats', 'dubaiTransport.stats'],
    ['container summary ABC123', 'container.summary'],
    ['all outstanding', 'receivables.all_outstanding'],
    ['pending invoices', 'invoices.pending']
  ];

  cases.forEach(([message, expected]) => {
    assert.equal(parseMessage(message).intent, expected, message);
  });
});

test('extracts invoice, container, customer and date entities', () => {
  assert.equal(parseMessage('sales invoice INV-100').entities.invoiceNumber, 'INV-100');
  assert.equal(parseMessage('container summary ABC123').entities.containerNo, 'ABC123');
  assert.equal(
    parseMessage('outstanding for customer Ahmed Traders').entities.customerName,
    'Ahmed Traders'
  );
  assert.equal(parseMessage('sales this month').entities.dateRange.label, 'this month');
});

test('reports missing required entities and invalid dates', () => {
  assert.deepEqual(parseMessage('sales invoice').missingEntities, ['invoiceNumber']);
  assert.equal(parseMessage('ledger 31/02/2026').entities.invalidDate, true);
});

test('supports light fuzzy matching for command words', () => {
  assert.equal(parseMessage('custmer Ahmed').intent, 'customers.get');
  assert.equal(parseMessage('freigt stats').intent, 'freight.stats');
});
