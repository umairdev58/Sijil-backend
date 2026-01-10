const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  activateProduct,
  searchProductsByName,
  getProductsByCategory,
  getProductStatistics
} = require('../controllers/productController');

const router = express.Router();

// @route   POST /api/products
// @desc    Create new product
// @access  Private (Admin/Employee)
router.post('/', [
  protect,
  requireEmployee,
  body('name', 'Product name is required').notEmpty().trim(),
  body('category', 'Category is required').notEmpty().isMongoId(),
  body('description', 'Description cannot be more than 500 characters').optional().isLength({ max: 500 }),
  body('sku', 'SKU cannot be more than 50 characters').optional().isLength({ max: 50 }),
  body('unit', 'Unit cannot be more than 20 characters').optional().isLength({ max: 20 })
], validateRequest, createProduct);

// @route   GET /api/products
// @desc    Get all products with filtering and pagination
// @access  Private (Admin/Employee)
router.get('/', [protect, requireEmployee], getProducts);

// @route   GET /api/products/statistics
// @desc    Get product statistics
// @access  Private (Admin/Employee)
router.get('/statistics', [protect, requireEmployee], getProductStatistics);

// @route   GET /api/products/search/:name
// @desc    Search products by name
// @access  Private (Admin/Employee)
router.get('/search/:name', [protect, requireEmployee], searchProductsByName);

// @route   GET /api/products/category/:categoryId
// @desc    Get products by category
// @access  Private (Admin/Employee)
router.get('/category/:categoryId', [protect, requireEmployee], getProductsByCategory);

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Private (Admin/Employee)
router.get('/:id', [protect, requireEmployee], getProductById);

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin/Employee)
router.put('/:id', [
  protect,
  requireEmployee,
  body('name', 'Product name is required').notEmpty().trim(),
  body('category', 'Category must be a valid MongoDB ID').optional().isMongoId(),
  body('description', 'Description cannot be more than 500 characters').optional().isLength({ max: 500 }),
  body('sku', 'SKU cannot be more than 50 characters').optional().isLength({ max: 50 }),
  body('unit', 'Unit cannot be more than 20 characters').optional().isLength({ max: 20 })
], validateRequest, updateProduct);

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete - deactivates)
// @access  Private (Admin/Employee)
router.delete('/:id', [protect, requireEmployee], deleteProduct);

// @route   POST /api/products/:id/activate
// @desc    Activate product
// @access  Private (Admin/Employee)
router.post('/:id/activate', [protect, requireEmployee], activateProduct);

module.exports = router;

