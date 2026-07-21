const express = require('express');
const { protect, requireAdmin, requireOrganization } = require('../middleware/auth');
const controller = require('../controllers/organizationController');

const router = express.Router();
router.use(protect, requireOrganization);

router.get('/me', controller.getOwnOrganization);
router.patch('/me', requireAdmin, controller.updateOwnOrganization);

module.exports = router;
