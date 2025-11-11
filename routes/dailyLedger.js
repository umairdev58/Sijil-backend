const express = require('express');
const router = express.Router();
const dailyLedgerController = require('../controllers/dailyLedgerController');
const { protect } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(protect);

// Daily Ledger routes
router.get('/summary', dailyLedgerController.getLedgerSummary);
router.get('/:date/export/pdf', dailyLedgerController.exportToPDF);
router.get('/:date', dailyLedgerController.getDailyLedger);
router.post('/', dailyLedgerController.createOrUpdateDailyLedger);
router.put('/:date/close', dailyLedgerController.closeDailyLedger);

// Ledger Entry routes
router.get('/entries', dailyLedgerController.getAllLedgerEntries);
router.get('/:date/entries', dailyLedgerController.getLedgerEntries);
router.post('/entries', dailyLedgerController.addLedgerEntry);
router.delete('/entries/:id', dailyLedgerController.deleteLedgerEntry);

module.exports = router;
