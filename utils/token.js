const jwt = require('jsonwebtoken');

const generateToken = (id, extra = {}) => {
  return jwt.sign({ id, ...extra }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

module.exports = { generateToken };
