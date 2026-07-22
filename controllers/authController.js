const User = require('../models/User');
const Organization = require('../models/Organization');
const { generateToken } = require('../utils/token');

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact administrator.'
      });
    }

    let organization = null;
    if (user.role !== 'superadmin') {
      organization = await Organization.findById(user.organizationId);
      if (!organization || organization.status !== 'active') {
        return res.status(403).json({
          error: 'Organization inactive',
          message: 'Your organization is inactive or unavailable'
        });
      }
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organization,
      department: user.department,
      position: user.position,
      isActive: user.isActive,
      trn: user.trn,
      lastLogin: user.lastLogin
    };
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser,
      data: safeUser
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.user.id,
      ...(req.organizationId ? { organizationId: req.organizationId } : { role: 'superadmin' })
    });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organization: req.organization || null,
      department: user.department,
      position: user.position,
      isActive: user.isActive,
      trn: user.trn,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      impersonatedBy: req.impersonatedBy || null
    };
    res.json({
      success: true,
      user: safeUser,
      data: safeUser
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
const logout = (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
};

// @desc    Change user password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findOne({
      _id: req.user.id,
      ...(req.organizationId ? { organizationId: req.organizationId } : { role: 'superadmin' })
    }).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Verify admin password for sensitive operations
// @route   POST /api/auth/verify-admin-password
// @access  Private (Admin only)
const verifyAdminPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        error: 'Password required',
        message: 'Please provide your password'
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only administrators can perform this action'
      });
    }

    // Get user with password
    const user = await User.findOne({
      _id: req.user.id,
      organizationId: req.organizationId
    }).select('+password');
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Invalid password',
        message: 'Password is incorrect'
      });
    }

    res.json({
      success: true,
      message: 'Password verified successfully'
    });

  } catch (error) {
    console.error('Verify admin password error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, email, department, position, trn } = req.body;

    // Get user
    const user = await User.findOne({
      _id: req.user.id,
      ...(req.organizationId ? { organizationId: req.organizationId } : { role: 'superadmin' })
    });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ 
          error: 'Email already exists',
          message: 'This email is already registered'
        });
      }
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (department) user.department = department;
    if (position) user.position = position;
    if (typeof trn === 'string') user.trn = trn;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        department: user.department,
        position: user.position,
        isActive: user.isActive,
        trn: user.trn,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  login,
  getCurrentUser,
  logout,
  changePassword,
  verifyAdminPassword,
  updateProfile
}; 