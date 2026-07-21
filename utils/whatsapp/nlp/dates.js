const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const range = (start, end, label) => ({
  start: startOfDay(start),
  end: endOfDay(end),
  label
});

const parseExplicitDate = (text) => {
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  let value;

  if (iso) value = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (slash) value = new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));
  if (!value || Number.isNaN(value.getTime())) return null;

  const validDay = iso ? Number(iso[3]) : Number(slash[1]);
  const validMonth = iso ? Number(iso[2]) : Number(slash[2]);
  if (value.getDate() !== validDay || value.getMonth() !== validMonth - 1) {
    return { invalid: true };
  }
  return range(value, value, value.toLocaleDateString('en-GB'));
};

const parseDateRange = (text, now = new Date()) => {
  const normalized = text.toLowerCase();
  const today = startOfDay(now);

  if (/\btoday\b/.test(normalized)) return range(today, today, 'today');
  if (/\byesterday\b/.test(normalized)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return range(yesterday, yesterday, 'yesterday');
  }
  if (/\b(last|past)\s+7\s+days?\b|\bthis\s+week\b/.test(normalized)) {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return range(start, today, 'the last 7 days');
  }
  if (/\b(last|past)\s+30\s+days?\b/.test(normalized)) {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return range(start, today, 'the last 30 days');
  }
  if (/\bthis\s+month\b/.test(normalized)) {
    return range(new Date(today.getFullYear(), today.getMonth(), 1), today, 'this month');
  }
  if (/\blast\s+month\b/.test(normalized)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return range(start, end, 'last month');
  }
  if (/\bthis\s+year\b|\bytd\b/.test(normalized)) {
    return range(new Date(today.getFullYear(), 0, 1), today, 'this year');
  }

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const monthMatch = normalized.match(new RegExp(`\\b(${monthNames.join('|')})\\s*(20\\d{2})?\\b`));
  if (monthMatch) {
    const month = monthNames.indexOf(monthMatch[1]);
    const year = monthMatch[2] ? Number(monthMatch[2]) : today.getFullYear();
    return range(
      new Date(year, month, 1),
      new Date(year, month + 1, 0),
      `${monthNames[month]} ${year}`
    );
  }

  return parseExplicitDate(normalized);
};

module.exports = { parseDateRange, startOfDay, endOfDay };
