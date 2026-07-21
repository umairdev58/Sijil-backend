const express = require('express');
const { body } = require('express-validator');
const { protect, requireSuperadmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const controller = require('../controllers/platformController');

const router = express.Router();
router.use(protect, requireSuperadmin);

router.get('/organizations', controller.getOrganizations);
router.post('/organizations', [
  body('name').notEmpty().trim(),
  body('slug').optional().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body('adminName').notEmpty().trim(),
  body('adminEmail').isEmail(),
  body('adminPassword').isLength({ min: 6 })
], validateRequest, controller.createOrganization);
router.get('/organizations/:id', controller.getOrganization);
router.patch('/organizations/:id', controller.updateOrganization);
router.patch('/organizations/:id/status', [
  body('status').isIn(['active', 'suspended'])
], validateRequest, controller.setOrganizationStatus);
router.delete('/organizations/:id', controller.deleteOrganization);

module.exports = router;
