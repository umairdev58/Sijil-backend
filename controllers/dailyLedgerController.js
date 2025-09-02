const DailyLedger = require('../models/DailyLedger');
const LedgerEntry = require('../models/LedgerEntry');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Get daily ledger by date
const getDailyLedger = async (req, res) => {
  try {
    const { date } = req.params;
    const ledgerDate = new Date(date);
    
    const dailyLedger = await DailyLedger.findByDate(ledgerDate);
    const entries = await LedgerEntry.findByDate(ledgerDate);
    
    if (!dailyLedger) {
      return res.status(404).json({
        success: false,
        message: 'Daily ledger not found for this date'
      });
    }
    
    res.json({
      success: true,
      data: {
        ledger: dailyLedger,
        entries: entries
      }
    });
  } catch (error) {
    console.error('Error getting daily ledger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create or update daily ledger
const createOrUpdateDailyLedger = async (req, res) => {
  try {
    const { date, opening_cash, opening_bank, notes } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }
    
    const ledgerDate = new Date(date);
    const existingLedger = await DailyLedger.findByDate(ledgerDate);
    
    if (existingLedger && existingLedger.is_closed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify a closed ledger'
      });
    }
    
    const ledgerData = {
      opening_cash: opening_cash || 0,
      opening_bank: opening_bank || 0,
      notes: notes || ''
    };
    
    const dailyLedger = await DailyLedger.createOrUpdate(ledgerDate, ledgerData);
    
    res.json({
      success: true,
      data: dailyLedger,
      message: existingLedger ? 'Daily ledger updated successfully' : 'Daily ledger created successfully'
    });
  } catch (error) {
    console.error('Error creating/updating daily ledger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Add ledger entry
const addLedgerEntry = async (req, res) => {
  try {
    const { ledger_date, type, mode, description, amount, reference_type, reference_id, reference_model } = req.body;
    
    if (!ledger_date || !type || !mode || !description || !amount) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }
    
    // Check if daily ledger exists for this date
    const ledgerDate = new Date(ledger_date);
    const dailyLedger = await DailyLedger.findByDate(ledgerDate);
    
    if (!dailyLedger) {
      return res.status(400).json({
        success: false,
        message: 'Daily ledger must be created before adding entries'
      });
    }
    
    if (dailyLedger.is_closed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add entries to a closed ledger'
      });
    }
    
    const entry = new LedgerEntry({
      ledger_date: ledgerDate,
      type,
      mode,
      description,
      amount,
      reference_type: reference_type || 'manual',
      reference_id,
      reference_model
    });
    
    await entry.save();
    
    // Update daily ledger totals
    await updateDailyLedgerTotals(ledgerDate);
    
    res.json({
      success: true,
      data: entry,
      message: 'Ledger entry added successfully'
    });
  } catch (error) {
    console.error('Error adding ledger entry:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get ledger entries by date
const getLedgerEntries = async (req, res) => {
  try {
    const { date } = req.params;
    const ledgerDate = new Date(date);
    
    const entries = await LedgerEntry.findByDate(ledgerDate);
    
    res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error('Error getting ledger entries:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete ledger entry
const deleteLedgerEntry = async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await LedgerEntry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Ledger entry not found'
      });
    }
    
    // Check if daily ledger is closed
    const dailyLedger = await DailyLedger.findByDate(entry.ledger_date);
    if (dailyLedger && dailyLedger.is_closed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete entry from a closed ledger'
      });
    }
    
    await LedgerEntry.findByIdAndDelete(id);
    
    // Update daily ledger totals
    await updateDailyLedgerTotals(entry.ledger_date);
    
    res.json({
      success: true,
      message: 'Ledger entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ledger entry:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Close daily ledger
const closeDailyLedger = async (req, res) => {
  try {
    const { date } = req.params;
    const ledgerDate = new Date(date);
    
    const dailyLedger = await DailyLedger.findByDate(ledgerDate);
    if (!dailyLedger) {
      return res.status(404).json({
        success: false,
        message: 'Daily ledger not found'
      });
    }
    
    if (dailyLedger.is_closed) {
      return res.status(400).json({
        success: false,
        message: 'Daily ledger is already closed'
      });
    }
    
    // Update totals before closing
    await updateDailyLedgerTotals(ledgerDate);
    
    // Close the ledger
    dailyLedger.is_closed = true;
    await dailyLedger.save();
    
    res.json({
      success: true,
      data: dailyLedger,
      message: 'Daily ledger closed successfully'
    });
  } catch (error) {
    console.error('Error closing daily ledger:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get ledger summary
const getLedgerSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const ledgers = await DailyLedger.find({
      date: {
        $gte: start,
        $lte: end
      }
    }).sort({ date: 1 });
    
    const summary = {
      totalDays: ledgers.length,
      totalOpeningCash: ledgers.reduce((sum, ledger) => sum + ledger.opening_cash, 0),
      totalOpeningBank: ledgers.reduce((sum, ledger) => sum + ledger.opening_bank, 0),
      totalReceiptsCash: ledgers.reduce((sum, ledger) => sum + ledger.receipts_cash, 0),
      totalReceiptsBank: ledgers.reduce((sum, ledger) => sum + ledger.receipts_bank, 0),
      totalPaymentsCash: ledgers.reduce((sum, ledger) => sum + ledger.payments_cash, 0),
      totalPaymentsBank: ledgers.reduce((sum, ledger) => sum + ledger.payments_bank, 0),
      totalAutoSalesInflow: ledgers.reduce((sum, ledger) => sum + ledger.auto_sales_inflow, 0),
      totalClosingCash: ledgers.reduce((sum, ledger) => sum + ledger.closing_cash, 0),
      totalClosingBank: ledgers.reduce((sum, ledger) => sum + ledger.closing_bank, 0),
      ledgers: ledgers
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting ledger summary:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Export daily ledger to PDF
const exportToPDF = async (req, res) => {
  try {
    const { date } = req.params;
    const ledgerDate = new Date(date);
    
    const dailyLedger = await DailyLedger.findByDate(ledgerDate);
    const entries = await LedgerEntry.findByDate(ledgerDate);
    
    if (!dailyLedger) {
      return res.status(404).json({
        success: false,
        message: 'Daily ledger not found'
      });
    }
    
    const doc = new PDFDocument();
    const filename = `daily-ledger-${date}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    // Add content to PDF
    doc.fontSize(20).text('Daily Ledger Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Date: ${new Date(date).toLocaleDateString()}`);
    doc.moveDown();
    
    // Opening balances
    doc.fontSize(12).text('Opening Balances:');
    doc.fontSize(10).text(`Cash: AED ${dailyLedger.opening_cash.toLocaleString()}`);
    doc.fontSize(10).text(`Bank: AED ${dailyLedger.opening_bank.toLocaleString()}`);
    doc.moveDown();
    
    // Entries
    doc.fontSize(12).text('Entries:');
    entries.forEach((entry, index) => {
      doc.fontSize(10).text(`${index + 1}. ${entry.type.toUpperCase()} - ${entry.mode.toUpperCase()}`);
      doc.fontSize(9).text(`   ${entry.description}`);
      doc.fontSize(9).text(`   Amount: AED ${entry.amount.toLocaleString()}`);
      doc.moveDown(0.5);
    });
    
    // Closing balances
    doc.fontSize(12).text('Closing Balances:');
    doc.fontSize(10).text(`Cash: AED ${dailyLedger.closing_cash.toLocaleString()}`);
    doc.fontSize(10).text(`Bank: AED ${dailyLedger.closing_bank.toLocaleString()}`);
    
    doc.end();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to update daily ledger totals
const updateDailyLedgerTotals = async (date) => {
  try {
    const totals = await LedgerEntry.calculateTotalsByDate(date);
    
    const dailyLedger = await DailyLedger.findByDate(date);
    if (!dailyLedger) return;
    
    // Reset totals
    dailyLedger.receipts_cash = 0;
    dailyLedger.receipts_bank = 0;
    dailyLedger.payments_cash = 0;
    dailyLedger.payments_bank = 0;
    
    // Update totals based on entries
    totals.forEach(total => {
      if (total._id.type === 'receipt') {
        if (total._id.mode === 'cash') {
          dailyLedger.receipts_cash += total.total;
        } else {
          dailyLedger.receipts_bank += total.total;
        }
      } else {
        if (total._id.mode === 'cash') {
          dailyLedger.payments_cash += total.total;
        } else {
          dailyLedger.payments_bank += total.total;
        }
      }
    });
    
    await dailyLedger.save();
  } catch (error) {
    console.error('Error updating daily ledger totals:', error);
  }
};

// Auto-create ledger entry for sales payment
const createSalesPaymentEntry = async (saleId, paymentAmount, paymentMethod) => {
  try {
    const sale = await require('./salesController').getSaleById(saleId);
    if (!sale) return;
    
    const paymentDate = new Date();
    const mode = paymentMethod === 'cash' ? 'cash' : 'bank';
    
    // Check if daily ledger exists for today
    let dailyLedger = await DailyLedger.findByDate(paymentDate);
    if (!dailyLedger) {
      // Create daily ledger with zero opening balances
      dailyLedger = await DailyLedger.createOrUpdate(paymentDate, {
        opening_cash: 0,
        opening_bank: 0
      });
    }
    
    // Create ledger entry
    const entry = new LedgerEntry({
      ledger_date: paymentDate,
      type: 'receipt',
      mode: mode,
      description: `Payment received for Invoice #${sale.invoiceNumber}`,
      amount: paymentAmount,
      reference_type: 'sales_payment',
      reference_id: saleId,
      reference_model: 'Sales'
    });
    
    await entry.save();
    
    // Update daily ledger totals
    await updateDailyLedgerTotals(paymentDate);
    
  } catch (error) {
    console.error('Error creating sales payment entry:', error);
  }
};

module.exports = {
  getDailyLedger,
  createOrUpdateDailyLedger,
  addLedgerEntry,
  getLedgerEntries,
  deleteLedgerEntry,
  closeDailyLedger,
  getLedgerSummary,
  exportToPDF,
  createSalesPaymentEntry
};
