const AuditLog = require('../models/AuditLog');

const writeAuditLog = async ({
  req,
  action,
  resourceType,
  resourceId = null,
  organizationId = null,
  metadata = {}
}) => {
  try {
    await AuditLog.create({
      actorId: req?.user?._id || null,
      actorEmail: req?.user?.email || '',
      actorRole: req?.user?.role || '',
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      organizationId: organizationId || null,
      metadata,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || ''
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
};

module.exports = { writeAuditLog };
