const maskPhone = (phoneNumber) => {
  const value = String(phoneNumber || '');
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
};

const write = (level, event, details = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    channel: 'whatsapp',
    event,
    ...details
  };
  const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  method(JSON.stringify(entry));
};

module.exports = {
  maskPhone,
  info: (event, details) => write('info', event, details),
  warn: (event, details) => write('warn', event, details),
  error: (event, details) => write('error', event, details)
};
