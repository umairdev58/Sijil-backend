const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createSale,
  getSales,
  getSaleById,
  updateSale,
  addPayment,
  getPaymentHistory,
  deletePayment,
  deleteSale,
  getSalesStatistics,
  generateSalesReport,
  getMonthlyStatistics,
  printInvoice,
  getCustomerOutstanding,
  generateCustomerOutstandingPDF,
  getUniqueProducts,
  getAutocompleteSuggestions,
  getRecentPayments
} = require('../controllers/salesController');

const router = express.Router();

// @route   POST /api/sales
// @desc    Create new sale
// @access  Private (Admin/Employee)
router.post('/', [
  protect,
  requireEmployee,
  body('customer', 'Customer is required').notEmpty().trim(),
  body('containerNo', 'Container number is required').notEmpty().trim(),
  body('supplier', 'Supplier is required').notEmpty().trim(),
  body('invoiceDate', 'Invoice date is required').isISO8601(),
  body('product', 'Product is required').notEmpty().trim(),
  body('marka', 'Marka is required').notEmpty().trim(),
  body('description', 'Description is required').notEmpty().trim(),
  body('quantity', 'Quantity must be a positive number').isInt({ min: 1 }),
  body('rate', 'Rate must be a positive number').isFloat({ min: 0 }),
  body('vatPercentage', 'VAT percentage must be between 0 and 100').optional().isFloat({ min: 0, max: 100 }),
  body('discount', 'Discount must be a positive number').optional().isFloat({ min: 0 }),
  body('dueDate', 'Due date is required').isISO8601()
], validateRequest, createSale);

// @route   GET /api/sales
// @desc    Get all sales with filtering and pagination
// @access  Private (Admin/Employee)
router.get('/', [protect, requireEmployee], getSales);

// @route   GET /api/sales/statistics
// @desc    Get sales statistics
// @access  Private (Admin/Employee)
router.get('/statistics', [protect, requireEmployee], getSalesStatistics);

// @route   GET /api/sales/statistics/monthly
// @desc    Get monthly sales statistics
// @access  Private (Admin/Employee)
router.get('/statistics/monthly', [protect, requireEmployee], getMonthlyStatistics);

// @route   GET /api/sales/report
// @desc    Generate sales report
// @access  Private (Admin/Employee)
router.get('/report', [protect, requireEmployee], generateSalesReport);

// @route   GET /api/sales/customer-outstanding
// @desc    Get customer outstanding amounts
// @access  Private (Admin/Employee)
router.get('/customer-outstanding', [protect, requireEmployee], getCustomerOutstanding);

// @route   GET /api/sales/customer-outstanding/pdf
// @desc    Generate customer outstanding PDF report
// @access  Private (Admin/Employee)
router.get('/customer-outstanding/pdf', [protect, requireEmployee], generateCustomerOutstandingPDF);

// @route   GET /api/sales/products
// @desc    Get unique products for filtering
// @access  Private (Admin/Employee)
router.get('/products', [protect, requireEmployee], getUniqueProducts);

// @route   GET /api/sales/autocomplete/:field
// @desc    Get autocomplete suggestions for sales form fields
// @access  Private (Admin/Employee)
router.get('/autocomplete/:field', [protect, requireEmployee], getAutocompleteSuggestions);

// @route   GET /api/payments/recent
// @desc    Get recent payments
// @access  Private (Admin/Employee)
router.get('/payments/recent', [protect, requireEmployee], getRecentPayments);

// @route   GET /api/sales/:id
// @desc    Get sale by ID with payment history
// @access  Private (Admin/Employee)
router.get('/:id', [protect, requireEmployee], getSaleById);

// @route   GET /api/sales/:id/print
// @desc    Print single invoice PDF (A4 half size)
// @access  Private (Admin/Employee)
router.get('/:id/print', [protect, requireEmployee], printInvoice);

// @route   GET /api/sales/:id/payments
// @desc    Get payment history for a sale
// @access  Private (Admin/Employee)
router.get('/:id/payments', [protect, requireEmployee], getPaymentHistory);

// @route   DELETE /api/sales/:saleId/payments/:paymentId
// @desc    Delete a payment transaction
// @access  Private (Admin only)
router.delete('/:saleId/payments/:paymentId', [
  protect, 
  requireAdmin,
  body('password', 'Admin password is required for deletion').exists()
], validateRequest, deletePayment);

// @route   PUT /api/sales/:id
// @desc    Update sale
// @access  Private (Admin/Employee)
router.put('/:id', [
  protect,
  requireEmployee,
  body('customer', 'Customer is required').notEmpty().trim(),
  body('containerNo', 'Container number is required').notEmpty().trim(),
  body('supplier', 'Supplier is required').notEmpty().trim(),
  body('invoiceDate', 'Invoice date is required').isISO8601(),
  body('product', 'Product is required').notEmpty().trim(),
  body('marka', 'Marka is required').notEmpty().trim(),
  body('description', 'Description is required').notEmpty().trim(),
  body('quantity', 'Quantity must be a positive number').isInt({ min: 1 }),
  body('rate', 'Rate must be a positive number').isFloat({ min: 0 }),
  body('vatPercentage', 'VAT percentage must be between 0 and 100').optional().isFloat({ min: 0, max: 100 }),
  body('dueDate', 'Due date is required').isISO8601()
], validateRequest, updateSale);

// @route   POST /api/sales/:id/payment
// @desc    Add payment to sale
// @access  Private (Admin/Employee)
router.post('/:id/payments', [
  protect,
  requireEmployee,
  body('amount', 'Payment amount must be a positive number').isFloat({ min: 0.01 }),
  body('paymentType', 'Payment type must be partial or full').isIn(['partial', 'full']),
  body('paymentMethod', 'Payment method must be valid').optional().isIn(['cash', 'bank_transfer', 'check', 'card', 'other']),
  body('reference', 'Reference cannot be more than 100 characters').optional().isLength({ max: 100 }),
  body('notes', 'Notes cannot be more than 500 characters').optional().isLength({ max: 500 }),
  body('paymentDate', 'Payment date must be a valid date').optional().isISO8601(),
  body('discount', 'Discount must be a non-negative number').optional().isFloat({ min: 0 })
], validateRequest, addPayment);

// @route   DELETE /api/sales/:id
// @desc    Delete sale
// @access  Private (Admin only)
router.delete('/:id', [
  protect, 
  requireAdmin,
  body('password', 'Admin password is required for deletion').exists()
], validateRequest, deleteSale);

module.exports = router; 