const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  generatePurchaseReport,
} = require('../controllers/purchaseController');

const router = express.Router();

// Create
router.post(
  '/',
  [
    protect,
    requireEmployee,
    body('containerNo', 'Container number is required').notEmpty().trim(),
    body('product', 'Product is required').notEmpty().trim(),
    body('quantity', 'Quantity must be a positive number').isInt({ min: 1 }),
    body('rate', 'Rate must be a non-negative number').isFloat({ min: 0 }),
    body('transport').optional().isFloat({ min: 0 }),
    body('freight').optional().isFloat({ min: 0 }),
    body('eForm').optional().isFloat({ min: 0 }),
    body('miscellaneous').optional().isFloat({ min: 0 }),
    body('transferRate', 'Transfer rate (PKR per AED) must be greater than 0').isFloat({ min: 0.000001 }),
  ],
  validateRequest,
  createPurchase
);

// List
router.get('/', [protect, requireEmployee], getPurchases);

// Generate report
router.get('/report', [protect, requireEmployee], generatePurchaseReport);

// Get one
router.get('/:id', [protect, requireEmployee], getPurchaseById);

// Update
router.put(
  '/:id',
  [
    protect,
    requireEmployee,
    body('containerNo', 'Container number is required').notEmpty().trim(),
    body('product', 'Product is required').notEmpty().trim(),
    body('quantity', 'Quantity must be a positive number').isInt({ min: 1 }),
    body('rate', 'Rate must be a non-negative number').isFloat({ min: 0 }),
    body('transport').optional().isFloat({ min: 0 }),
    body('freight').optional().isFloat({ min: 0 }),
    body('eForm').optional().isFloat({ min: 0 }),
    body('miscellaneous').optional().isFloat({ min: 0 }),
    body('transferRate', 'Transfer rate (PKR per AED) must be greater than 0').isFloat({ min: 0.000001 }),
  ],
  validateRequest,
  updatePurchase
);

// Delete
router.delete('/:id', [protect, requireEmployee], deletePurchase);

module.exports = router;


