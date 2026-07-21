const number = (value) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
}).format(Number(value || 0));

const money = (value, currency = 'AED') => `${currency} ${number(value)}`;

const date = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-GB');
};

const status = (value) => {
  const labels = {
    paid: 'Paid',
    unpaid: 'Unpaid',
    partially_paid: 'Partially paid',
    overdue: 'Overdue'
  };
  return labels[value] || String(value || 'Unknown');
};

const heading = (title) => `*${title}*`;

const limitedList = (items, render, total = items.length, limit = 10) => {
  const visible = items.slice(0, limit);
  if (!visible.length) return 'No matching records found.';
  const lines = visible.map((item, index) => render(item, index));
  if (total > visible.length) {
    lines.push(`\nShowing ${visible.length} of ${total}.`);
  }
  return lines.join('\n');
};

const errorMessages = {
  unknown: 'I could not recognize that command. Type *help* to see available commands.',
  invalidDate: 'That date is not valid. Use formats like *21/07/2026*, *2026-07-21*, *today*, or *this month*.',
  internal: 'Sorry, I could not complete that request. Please try again later.'
};

module.exports = { number, money, date, status, heading, limitedList, errorMessages };
