const DailyLedger = require('../../../models/DailyLedger');
const LedgerEntry = require('../../../models/LedgerEntry');
const { parseDateRange } = require('../nlp/dates');
const { heading, money, date, limitedList } = require('../formatter');

const handleLedger = async ({ entities, intent }) => {
  const dateRange = entities.dateRange || parseDateRange('today');

  if (intent === 'ledger.summary') {
    const ledgers = await DailyLedger.find({
      date: { $gte: dateRange.start, $lte: dateRange.end }
    }).sort({ date: 1 }).lean();
    const totals = ledgers.reduce((result, ledger) => ({
      receiptsCash: result.receiptsCash + ledger.receipts_cash,
      receiptsBank: result.receiptsBank + ledger.receipts_bank,
      paymentsCash: result.paymentsCash + ledger.payments_cash,
      paymentsBank: result.paymentsBank + ledger.payments_bank,
      salesInflow: result.salesInflow + ledger.auto_sales_inflow
    }), { receiptsCash: 0, receiptsBank: 0, paymentsCash: 0, paymentsBank: 0, salesInflow: 0 });
    return [
      heading(`Ledger summary — ${dateRange.label}`),
      `Days recorded: ${ledgers.length}`,
      `Cash receipts: ${money(totals.receiptsCash)}`,
      `Bank receipts: ${money(totals.receiptsBank)}`,
      `Cash payments: ${money(totals.paymentsCash)}`,
      `Bank payments: ${money(totals.paymentsBank)}`,
      `Sales inflow: ${money(totals.salesInflow)}`
    ].join('\n');
  }

  const ledger = await DailyLedger.findOne({
    date: { $gte: dateRange.start, $lte: dateRange.end }
  }).lean();
  if (!ledger) return `No daily ledger was found for *${dateRange.label}*.`;

  if (intent === 'ledger.cash_position') {
    return [
      heading(`Cash & bank position — ${date(ledger.date)}`),
      `Opening cash: ${money(ledger.opening_cash)}`,
      `Closing cash: ${money(ledger.closing_cash)}`,
      `Opening bank: ${money(ledger.opening_bank)}`,
      `Closing bank: ${money(ledger.closing_bank)}`,
      `Day status: ${ledger.is_closed ? 'Closed' : 'Open'}`
    ].join('\n');
  }

  const entries = await LedgerEntry.findByDate(ledger.date);
  return [
    heading(`Daily ledger — ${date(ledger.date)}`),
    `Opening cash: ${money(ledger.opening_cash)}`,
    `Opening bank: ${money(ledger.opening_bank)}`,
    `Receipts: ${money(ledger.receipts_cash + ledger.receipts_bank)}`,
    `Payments: ${money(ledger.payments_cash + ledger.payments_bank)}`,
    `Sales inflow: ${money(ledger.auto_sales_inflow)}`,
    `Closing cash: ${money(ledger.closing_cash)}`,
    `Closing bank: ${money(ledger.closing_bank)}`,
    '',
    heading('Entries'),
    limitedList(entries, (entry) => (
      `• ${entry.type === 'receipt' ? '+' : '-'}${money(entry.amount)} — ${entry.description}\n  ${entry.mode}`
    ), entries.length, entities.limit)
  ].join('\n');
};

module.exports = { handleLedger };
