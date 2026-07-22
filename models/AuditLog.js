const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  actorEmail: {
    type: String,
    trim: true,
    default: ''
  },
  actorRole: {
    type: String,
    trim: true,
    default: ''
  },
  action: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  resourceType: {
    type: String,
    enum: ['organization', 'user', 'superadmin', 'auth', 'system'],
    required: true
  },
  resourceId: {
    type: String,
    default: null
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  ip: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
