const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const dateFilter = (field, dateRange) => {
  if (!dateRange || dateRange.invalid) return {};
  return { [field]: { $gte: dateRange.start, $lte: dateRange.end } };
};

const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] || 0), 0);

const cleanSearchQuery = (value, words = []) => {
  let result = String(value || '').trim();
  words.forEach((word) => {
    result = result.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'ig'), ' ');
  });
  return result.replace(/\s+/g, ' ').trim();
};

const missingEntityMessage = (entity) => {
  const messages = {
    invoiceNumber: 'Please include the invoice number.',
    containerNo: 'Please include the container number.',
    customerName: 'Please include the customer name.',
    supplierName: 'Please include the supplier name.',
    agent: 'Please include the agent name.',
    category: 'Please include the category name.',
    dateRange: 'Please include a date, for example *today*, *this month*, or *21/07/2026*.'
  };
  return messages[entity] || `Please include ${entity}.`;
};

module.exports = { escapeRegex, dateFilter, sum, cleanSearchQuery, missingEntityMessage };
