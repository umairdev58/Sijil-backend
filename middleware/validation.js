const { validationResult } = require('express-validator');

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation error',
      errors: errors.array() 
    });
  }
  next();
};

module.exports = {
  validateRequest
}; 