const express = require('express');
const { body } = require('express-validator');
const { protect, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deactivateUser,
  activateUser,
  resetPassword
} = require('../controllers/userController');

const router = express.Router();

// @route   POST /api/users
// @desc    Create new employee (Admin only)
// @access  Private (Admin)
router.post('/', [
  protect,
  requireAdmin,
  body('name', 'Name is required').notEmpty().trim(),
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  body('department').optional().trim(),
  body('position').optional().trim()
], validateRequest, createUser);

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/', [protect, requireAdmin], getUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID (Admin only)
// @access  Private (Admin)
router.get('/:id', [protect, requireAdmin], getUserById);

// @route   PUT /api/users/:id
// @desc    Update user (Admin only)
// @access  Private (Admin)
router.put('/:id', [
  protect,
  requireAdmin,
  body('name', 'Name is required').notEmpty().trim(),
  body('email', 'Please include a valid email').isEmail(),
  body('department').optional().trim(),
  body('position').optional().trim()
], validateRequest, updateUser);

// @route   DELETE /api/users/:id
// @desc    Deactivate user (Admin only)
// @access  Private (Admin)
router.delete('/:id', [protect, requireAdmin], deactivateUser);

// @route   POST /api/users/:id/activate
// @desc    Activate user (Admin only)
// @access  Private (Admin)
router.post('/:id/activate', [protect, requireAdmin], activateUser);

// @route   POST /api/users/:id/reset-password
// @desc    Reset user password (Admin only)
// @access  Private (Admin)
router.post('/:id/reset-password', [
  protect,
  requireAdmin,
  body('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
], validateRequest, resetPassword);

module.exports = router; 