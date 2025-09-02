const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deactivateCustomer,
  activateCustomer,
  searchCustomersByName,
  getCustomerStatistics
} = require('../controllers/customerController');

const router = express.Router();

// @route   POST /api/customers
// @desc    Create new customer
// @access  Private (Admin/Employee)
router.post('/', [
  protect,
  requireEmployee,
  body('ename', 'English name is required').notEmpty().trim(),
  body('uname', 'Urdu name cannot be more than 100 characters').optional().isLength({ max: 100 }),
  body('email', 'Please include a valid email').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) {
      return true; // Skip validation for empty values
    }
    return require('validator').isEmail(value);
  }),
  body('number', 'Phone number cannot be more than 20 characters').optional().isLength({ max: 20 })
], validateRequest, createCustomer);

// @route   GET /api/customers
// @desc    Get all customers with filtering and pagination
// @access  Private (Admin/Employee)
router.get('/', [protect, requireEmployee], getCustomers);

// @route   GET /api/customers/statistics
// @desc    Get customer statistics
// @access  Private (Admin/Employee)
router.get('/statistics', [protect, requireEmployee], getCustomerStatistics);

// @route   GET /api/customers/search/:name
// @desc    Search customers by name
// @access  Private (Admin/Employee)
router.get('/search/:name', [protect, requireEmployee], searchCustomersByName);

// @route   GET /api/customers/:id
// @desc    Get customer by ID
// @access  Private (Admin/Employee)
router.get('/:id', [protect, requireEmployee], getCustomerById);

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private (Admin/Employee)
router.put('/:id', [
  protect,
  requireEmployee,
  body('ename', 'English name is required').notEmpty().trim(),
  body('uname', 'Urdu name cannot be more than 100 characters').optional().isLength({ max: 100 }),
  body('email', 'Please include a valid email').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) {
      return true; // Skip validation for empty values
    }
    return require('validator').isEmail(value);
  }),
  body('number', 'Phone number cannot be more than 20 characters').optional().isLength({ max: 20 })
], validateRequest, updateCustomer);

// @route   DELETE /api/customers/:id
// @desc    Deactivate customer
// @access  Private (Admin/Employee)
router.delete('/:id', [protect, requireEmployee], deactivateCustomer);

// @route   POST /api/customers/:id/activate
// @desc    Activate customer
// @access  Private (Admin/Employee)
router.post('/:id/activate', [protect, requireEmployee], activateCustomer);

module.exports = router; 