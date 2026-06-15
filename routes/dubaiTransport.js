const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const router = express.Router();

const {
  getDubaiTransportInvoices,
  createDubaiTransportInvoice,
  getDubaiTransportInvoice,
  updateDubaiTransportInvoice,
  deleteDubaiTransportInvoice,
  addDubaiTransportPayment,
  getDubaiTransportPaymentHistory,
  getDubaiTransportInvoiceStats,
  printDubaiTransportInvoice,
  generateDubaiTransportReportPDF,
  generateDubaiTransportReportCSV
} = require('../controllers/dubaiTransportController');

const validateInvoice = [
  body('invoice_number')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Invoice number is required'),
  body('amount_aed')
    .isFloat({ min: 0.01 })
    .withMessage('Amount in AED must be greater than 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('container_number')
    .optional()
    .trim()
    .isLength({ max: 100 }),
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

router.get('/', [protect, requireEmployee], getDubaiTransportInvoices);
router.get('/stats', [protect, requireEmployee], getDubaiTransportInvoiceStats);
router.post('/', [protect, requireEmployee, validateInvoice, validateRequest], createDubaiTransportInvoice);
router.get('/:id', [protect, requireEmployee], getDubaiTransportInvoice);
router.put('/:id', [protect, requireEmployee, validateInvoice, validateRequest], updateDubaiTransportInvoice);
router.delete('/:id', [protect, requireEmployee], deleteDubaiTransportInvoice);
router.post('/:id/payments', [protect, requireEmployee, validatePayment, validateRequest], addDubaiTransportPayment);
router.get('/:id/payments', [protect, requireEmployee], getDubaiTransportPaymentHistory);
router.get('/:id/print', [protect, requireEmployee], printDubaiTransportInvoice);
router.get('/report/pdf', [protect, requireEmployee], generateDubaiTransportReportPDF);
router.get('/report/csv', [protect, requireEmployee], generateDubaiTransportReportCSV);

module.exports = router;
