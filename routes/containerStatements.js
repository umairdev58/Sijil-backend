const express = require('express');
const router = express.Router();
const {
  getContainerStatement,
  createContainerStatement,
  updateContainerStatement,
  addExpense,
  removeExpense,
  getAllContainerStatements,
  deleteContainerStatement,
  downloadStatementPDF
} = require('../controllers/containerStatementController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// IMPORTANT: Define specific routes before parameterized ones to avoid conflicts

// @route   GET /api/container-statements/:containerNo/pdf
// @desc    Download container statement as PDF
// @access  Private
router.get('/:containerNo/pdf', downloadStatementPDF);

// @route   GET /api/container-statements/:containerNo
// @desc    Get container statement by container number
// @access  Private
router.get('/:containerNo', getContainerStatement);

// @route   GET /api/container-statements
// @desc    Get all container statements with pagination
// @access  Private
router.get('/', getAllContainerStatements);

// @route   POST /api/container-statements
// @desc    Create new container statement
// @access  Private
router.post('/', createContainerStatement);

// @route   PUT /api/container-statements/:id
// @desc    Update container statement
// @access  Private
router.put('/:id', updateContainerStatement);

// @route   POST /api/container-statements/:id/expenses
// @desc    Add expense to container statement
// @access  Private
router.post('/:id/expenses', addExpense);

// @route   DELETE /api/container-statements/:id/expenses/:expenseId
// @desc    Remove expense from container statement
// @access  Private
router.delete('/:id/expenses/:expenseId', removeExpense);

// @route   DELETE /api/container-statements/:id
// @desc    Delete container statement
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), deleteContainerStatement);

module.exports = router;
