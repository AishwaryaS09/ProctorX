const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: { type: String, trim: true, maxlength: 120 },
    actorRole: { type: String, trim: true, maxlength: 30 },
    action: { type: String, required: true, trim: true, maxlength: 100, index: true },
    resource: { type: String, trim: true, maxlength: 100 },
    resourceId: { type: String, trim: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, trim: true, maxlength: 64 },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
