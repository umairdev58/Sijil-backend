const express = require('express');
const { body } = require('express-validator');
const { protect, requireEmployee } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  activateCategory,
  searchCategoriesByName,
  getCategoryStatistics
} = require('../controllers/categoryController');

const router = express.Router();

// @route   POST /api/categories
// @desc    Create new category
// @access  Private (Admin/Employee)
router.post('/', [
  protect,
  requireEmployee,
  body('name', 'Category name is required').notEmpty().trim(),
  body('description', 'Description cannot be more than 500 characters').optional().isLength({ max: 500 })
], validateRequest, createCategory);

// @route   GET /api/categories
// @desc    Get all categories with filtering and pagination
// @access  Private (Admin/Employee)
router.get('/', [protect, requireEmployee], getCategories);

// @route   GET /api/categories/statistics
// @desc    Get category statistics
// @access  Private (Admin/Employee)
router.get('/statistics', [protect, requireEmployee], getCategoryStatistics);

// @route   GET /api/categories/search/:name
// @desc    Search categories by name
// @access  Private (Admin/Employee)
router.get('/search/:name', [protect, requireEmployee], searchCategoriesByName);

// @route   GET /api/categories/:id
// @desc    Get category by ID
// @access  Private (Admin/Employee)
router.get('/:id', [protect, requireEmployee], getCategoryById);

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private (Admin/Employee)
router.put('/:id', [
  protect,
  requireEmployee,
  body('name', 'Category name is required').notEmpty().trim(),
  body('description', 'Description cannot be more than 500 characters').optional().isLength({ max: 500 })
], validateRequest, updateCategory);

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private (Admin/Employee)
router.delete('/:id', [protect, requireEmployee], deleteCategory);

// @route   POST /api/categories/:id/activate
// @desc    Activate category
// @access  Private (Admin/Employee)
router.post('/:id/activate', [protect, requireEmployee], activateCategory);

module.exports = router;

