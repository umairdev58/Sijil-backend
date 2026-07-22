const express = require('express');
const { body } = require('express-validator');
const { protect, requireSuperadmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const controller = require('../controllers/platformController');

const router = express.Router();
router.use(protect, requireSuperadmin);

router.get('/stats', controller.getDashboardStats);
router.get('/audit-logs', controller.listAuditLogs);

router.get('/superadmins', controller.listSuperadmins);
router.post('/superadmins', [
  body('name').notEmpty().trim(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], validateRequest, controller.createSuperadmin);
router.patch('/superadmins/:id/status', [
  body('isActive').isBoolean()
], validateRequest, controller.setSuperadminActive);

router.get('/organizations', controller.getOrganizations);
router.post('/organizations', [
  body('name').notEmpty().trim(),
  body('slug').optional().trim().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body('plan').optional().isIn(['free', 'standard', 'enterprise']),
  body('seatLimit').optional().isInt({ min: 1, max: 10000 }),
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

router.get('/organizations/:id/users', controller.listOrganizationUsers);
router.post('/organizations/:id/users', [
  body('name').notEmpty().trim(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(['admin', 'employee'])
], validateRequest, controller.createOrganizationUser);
router.patch('/organizations/:id/users/:userId', controller.updateOrganizationUser);
router.patch('/organizations/:id/users/:userId/status', [
  body('isActive').isBoolean()
], validateRequest, controller.setOrganizationUserActive);
router.post('/organizations/:id/users/:userId/reset-password', [
  body('newPassword').isLength({ min: 6 })
], validateRequest, controller.resetOrganizationUserPassword);
router.post('/organizations/:id/users/:userId/impersonate', controller.impersonateOrganizationUser);

module.exports = router;
