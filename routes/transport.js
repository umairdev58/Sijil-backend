const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createTransportInvoice,
  getTransportInvoices,
  getTransportInvoiceById,
  updateTransportInvoice,
  addTransportPayment,
  getTransportPaymentHistory,
  deleteTransportInvoice,
  getTransportInvoiceStats,
  printTransportInvoice,
  generateTransportReportPDF,
  generateTransportReportCSV
} = require('../controllers/transportController');

const router = express.Router();

// Create
router.post(
  '/',
  [
    protect,
    requireEmployee,
    body('amount_pkr', 'Amount in PKR is required and must be greater than 0').isFloat({ min: 0.01 }),
    body('conversion_rate', 'Conversion rate is required and must be greater than 0').isFloat({ min: 0.000001 }),
    body('agent', 'Agent is required').notEmpty().trim(),
    body('invoice_date', 'Invoice date is required').isISO8601(),
    body('due_date', 'Due date is required').isISO8601(),
  ],
  validateRequest,
  createTransportInvoice
);

// List
router.get('/', [protect, requireEmployee], getTransportInvoices);

// Get statistics
router.get('/stats', [protect, requireEmployee], getTransportInvoiceStats);

// Get one
router.get('/:id', [protect, requireEmployee], getTransportInvoiceById);

// Update
router.put(
  '/:id',
  [
    protect,
    requireEmployee,
    body('amount_pkr').optional().isFloat({ min: 0.01 }),
    body('conversion_rate').optional().isFloat({ min: 0.000001 }),
    body('agent').optional().notEmpty().trim(),
    body('invoice_date').optional().isISO8601(),
    body('due_date').optional().isISO8601(),
  ],
  validateRequest,
  updateTransportInvoice
);

// Add payment
router.post(
  '/:id/payment',
  [
    protect,
    requireEmployee,
    body('amount', 'Payment amount is required and must be greater than 0').isFloat({ min: 0.01 }),
    body('paymentType', 'Payment type is required').isIn(['partial', 'full']),
    body('paymentMethod').optional().isIn(['cash', 'bank_transfer', 'check', 'card', 'other']),
    body('reference').optional().isLength({ max: 100 }),
    body('notes').optional().isLength({ max: 500 }),
    body('paymentDate').optional().isISO8601(),
  ],
  validateRequest,
  addTransportPayment
);

// Get payment history
router.get('/:id/payments', [protect, requireEmployee], getTransportPaymentHistory);

// Print invoice
router.get('/:id/print', [protect, requireEmployee], printTransportInvoice);

// Generate reports
router.get('/report/pdf', [protect, requireEmployee], generateTransportReportPDF);
router.get('/report/csv', [protect, requireEmployee], generateTransportReportCSV);

// Delete
router.delete('/:id', [protect, requireEmployee], deleteTransportInvoice);

module.exports = router;
