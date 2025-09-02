const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createFreightInvoice,
  getFreightInvoices,
  getFreightInvoiceById,
  updateFreightInvoice,
  addFreightPayment,
  getFreightPaymentHistory,
  deleteFreightInvoice,
  getFreightInvoiceStats,
  printFreightInvoice,
  generateFreightReportPDF,
  generateFreightReportCSV
} = require('../controllers/freightController');

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
  createFreightInvoice
);

// List
router.get('/', [protect, requireEmployee], getFreightInvoices);

// Get statistics
router.get('/stats', [protect, requireEmployee], getFreightInvoiceStats);

// Generate reports
router.get('/report/pdf', [protect, requireEmployee], generateFreightReportPDF);
router.get('/report/csv', [protect, requireEmployee], generateFreightReportCSV);

// Get one
router.get('/:id', [protect, requireEmployee], getFreightInvoiceById);

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
  updateFreightInvoice
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
  addFreightPayment
);

// Get payment history
router.get('/:id/payments', [protect, requireEmployee], getFreightPaymentHistory);

// Print invoice
router.get('/:id/print', [protect, requireEmployee], printFreightInvoice);

// Delete
router.delete('/:id', [protect, requireEmployee], deleteFreightInvoice);

module.exports = router;
