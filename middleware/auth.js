const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Not authorized to access this route',
        message: 'No token provided'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Not authorized to access this route',
          message: 'User not found'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ 
          error: 'Account deactivated',
          message: 'Your account has been deactivated. Please contact administrator.'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ 
        error: 'Not authorized to access this route',
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error'
    });
  }
};

// Middleware to restrict access to admin only
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Not authorized to access this route',
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }

    next();
  };
};


// Middleware to check if user is admin
const requireAdmin = authorize('admin');

// Middleware to check if user is employee or admin
const requireEmployee = authorize('employee', 'admin');

module.exports = {
  protect,
  authorize,
  requireAdmin,
  requireEmployee
}; 