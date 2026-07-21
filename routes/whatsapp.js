const express = require('express');
const { body } = require('express-validator');
const { protect, requireAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  getAuthorizedNumbers,
  createAuthorizedNumber,
  updateAuthorizedNumber,
  deleteAuthorizedNumber
} = require('../controllers/whatsappAuthorizedNumberController');
const { verifyWebhook, receiveWebhook } = require('../controllers/whatsappController');

const router = express.Router();

const phoneValidation = body('phoneNumber')
  .notEmpty()
  .withMessage('Phone number is required')
  .custom((value) => /^\d{7,15}$/.test(String(value).replace(/\D/g, '')))
  .withMessage('Phone number must contain 7 to 15 digits including country code');

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

router.get('/authorized-numbers', [protect, requireAdmin], getAuthorizedNumbers);

router.post('/authorized-numbers', [
  protect,
  requireAdmin,
  phoneValidation,
  body('label').optional().trim().isLength({ max: 80 })
], validateRequest, createAuthorizedNumber);

router.put('/authorized-numbers/:id', [
  protect,
  requireAdmin,
  body('phoneNumber')
    .optional()
    .custom((value) => /^\d{7,15}$/.test(String(value).replace(/\D/g, '')))
    .withMessage('Phone number must contain 7 to 15 digits including country code'),
  body('label').optional().trim().isLength({ max: 80 }),
  body('isActive').optional().isBoolean()
], validateRequest, updateAuthorizedNumber);

router.delete('/authorized-numbers/:id', [protect, requireAdmin], deleteAuthorizedNumber);

module.exports = router;
