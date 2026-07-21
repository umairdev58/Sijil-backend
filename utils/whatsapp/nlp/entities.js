const { parseDateRange } = require('./dates');

const cleanValue = (value) => String(value || '')
  .replace(/[?.!,]+$/g, '')
  .trim();

const extractAfter = (text, expression) => {
  const match = text.match(expression);
  return match ? cleanValue(match[1]) : undefined;
};

const extractEntities = (text) => {
  const normalized = String(text || '').trim();
  const lowered = normalized.toLowerCase();
  const statusMap = [
    ['partially_paid', /\b(partially paid|partial|part paid)\b/],
    ['overdue', /\b(overdue|late)\b/],
    ['unpaid', /\b(unpaid|unsettled)\b/],
    ['pending', /\b(pending|open)\b/],
    ['paid', /\bpaid\b/]
  ];
  const status = statusMap.find(([, expression]) => expression.test(lowered))?.[0];
  const limitMatch = lowered.match(/\b(?:top|last|recent)\s+(\d{1,2})\b/);
  const dateRange = parseDateRange(lowered);

  return {
    status,
    dateRange,
    invalidDate: Boolean(dateRange?.invalid),
    limit: Math.min(Number(limitMatch?.[1] || 10), 20),
    invoiceNumber: extractAfter(normalized, /\b(?:invoices?|inv)\b(?:\s+(?:number|no|#))?\s*[:#-]?\s*([a-z0-9][a-z0-9/_-]*)/i),
    containerNo: extractAfter(normalized, /\bcontainer(?:\s+(?:number|no|#))?(?:\s+(?:summary|statement|profit|pnl|net))?\s*[:#-]?\s*([a-z0-9][a-z0-9/_-]*)/i),
    customerName: extractAfter(normalized, /\bcustomer(?:\s+(?:named|name))?\s*[:#-]?\s+(.+?)(?=\s+(?:today|yesterday|this|last|status|invoice|container)\b|$)/i),
    supplierName: extractAfter(normalized, /\bsupplier(?:\s+(?:named|name))?\s*[:#-]?\s+(.+?)(?=\s+(?:today|yesterday|this|last|status|invoice|container)\b|$)/i),
    agent: extractAfter(normalized, /\bagent(?:\s+(?:named|name))?\s*[:#-]?\s+(.+?)(?=\s+(?:today|yesterday|this|last|status|invoice)\b|$)/i),
    category: extractAfter(normalized, /\bcategory(?:\s+(?:named|name))?\s*[:#-]?\s+(.+?)(?=\s+(?:today|active|inactive)\b|$)/i),
    query: extractAfter(normalized, /\b(?:search|find|lookup|look up)\s+(?:for\s+)?(.+)$/i),
    rawText: normalized
  };
};

module.exports = { extractEntities };
