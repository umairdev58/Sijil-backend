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

const invoiceValidation = [
  body('invoice_number', 'Invoice number is required').notEmpty().trim(),
  body('amount_aed', 'Amount in AED is required and must be greater than 0').isFloat({ min: 0.01 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('container_number').optional().trim().isLength({ max: 100 }),
  body('invoice_date', 'Invoice date is required').isISO8601(),
  body('due_date', 'Due date is required').isISO8601(),
];

// Create
router.post(
  '/',
  [protect, requireEmployee, ...invoiceValidation],
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
    body('invoice_number').optional().notEmpty().trim(),
    body('amount_aed').optional().isFloat({ min: 0.01 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('container_number').optional().trim().isLength({ max: 100 }),
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
