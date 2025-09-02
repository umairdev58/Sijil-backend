const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
  searchSuppliersByName,
  getSupplierStatistics,
} = require('../controllers/supplierController');

const router = express.Router();

// Create supplier
router.post('/', [
  protect,
  requireEmployee,
  body('ename', 'English name is required').notEmpty().trim(),
  body('uname', 'Urdu name cannot be more than 100 characters').optional().isLength({ max: 100 }),
  body('email', 'Please include a valid email').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    return require('validator').isEmail(value);
  }),
  body('number', 'Phone number cannot be more than 20 characters').optional().isLength({ max: 20 }),
  body('marka', 'Marka cannot be more than 100 characters').optional().isLength({ max: 100 }),
], validateRequest, createSupplier);

// List suppliers
router.get('/', [protect, requireEmployee], getSuppliers);

// Statistics
router.get('/statistics', [protect, requireEmployee], getSupplierStatistics);

// Search
router.get('/search/:name', [protect, requireEmployee], searchSuppliersByName);

// Get by id
router.get('/:id', [protect, requireEmployee], getSupplierById);

// Update
router.put('/:id', [
  protect,
  requireEmployee,
  body('ename', 'English name is required').notEmpty().trim(),
  body('uname', 'Urdu name cannot be more than 100 characters').optional().isLength({ max: 100 }),
  body('email', 'Please include a valid email').optional().custom((value) => {
    if (value === '' || value === null || value === undefined) return true;
    return require('validator').isEmail(value);
  }),
  body('number', 'Phone number cannot be more than 20 characters').optional().isLength({ max: 20 }),
  body('marka', 'Marka cannot be more than 100 characters').optional().isLength({ max: 100 }),
], validateRequest, updateSupplier);

// Deactivate
router.delete('/:id', [protect, requireEmployee], deactivateSupplier);

// Activate
router.post('/:id/activate', [protect, requireEmployee], activateSupplier);

module.exports = router;

