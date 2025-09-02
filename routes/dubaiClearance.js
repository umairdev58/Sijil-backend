const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const router = express.Router();

const {
  getDubaiClearanceInvoices,
  createDubaiClearanceInvoice,
  getDubaiClearanceInvoice,
  updateDubaiClearanceInvoice,
  deleteDubaiClearanceInvoice,
  addDubaiClearancePayment,
  getDubaiClearancePaymentHistory,
  getDubaiClearanceInvoiceStats,
  printDubaiClearanceInvoice,
  generateDubaiClearanceReportPDF,
  generateDubaiClearanceReportCSV
} = require('../controllers/dubaiClearanceController');

// Validation middleware
const validateInvoice = [
  body('amount_aed')
    .isFloat({ min: 0.01 })
    .withMessage('Amount in AED must be greater than 0'),
  body('conversion_rate')
    .isFloat({ min: 0.01 })
    .withMessage('Conversion rate is required'),
  body('agent')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Agent is required and must be between 1 and 100 characters'),
  body('invoice_date')
    .isISO8601()
    .withMessage('Valid invoice date is required'),
  body('due_date')
    .isISO8601()
    .withMessage('Valid due date is required')
];

const validatePayment = [
  body('amount_aed')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  body('paymentType')
    .isIn(['partial', 'full'])
    .withMessage('Payment type must be either partial or full'),
  body('paymentMethod')
    .isIn(['cash', 'bank_transfer', 'check', 'card', 'other'])
    .withMessage('Invalid payment method'),
  body('paymentDate')
    .isISO8601()
    .withMessage('Valid payment date is required')
];

// Routes
// Get all invoices
router.get('/', [protect, requireEmployee], getDubaiClearanceInvoices);

// Get statistics
router.get('/stats', [protect, requireEmployee], getDubaiClearanceInvoiceStats);

// Create new invoice
router.post('/', [protect, requireEmployee, validateInvoice, validateRequest], createDubaiClearanceInvoice);

// Get single invoice
router.get('/:id', [protect, requireEmployee], getDubaiClearanceInvoice);

// Update invoice
router.put('/:id', [protect, requireEmployee, validateInvoice, validateRequest], updateDubaiClearanceInvoice);

// Delete invoice
router.delete('/:id', [protect, requireEmployee], deleteDubaiClearanceInvoice);

// Add payment
router.post('/:id/payments', [protect, requireEmployee, validatePayment, validateRequest], addDubaiClearancePayment);

// Get payment history
router.get('/:id/payments', [protect, requireEmployee], getDubaiClearancePaymentHistory);

// Print invoice
router.get('/:id/print', [protect, requireEmployee], printDubaiClearanceInvoice);



// Generate reports
router.get('/report/pdf', [protect, requireEmployee], generateDubaiClearanceReportPDF);
router.get('/report/csv', [protect, requireEmployee], generateDubaiClearanceReportCSV);

module.exports = router;
