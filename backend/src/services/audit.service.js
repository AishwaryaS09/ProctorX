const AuditLog = require('../models/AuditLog');

/**
 * Append a row to the audit trail.
 */
async function logAudit({ actor, action, resource, resourceId, details = {}, ip }) {
  const doc = await AuditLog.create({
    actor: actor ? actor._id : undefined,
    actorName: actor ? actor.name : 'system',
    actorRole: actor ? actor.role : 'system',
    action,
    resource,
    resourceId,
    details,
    ip,
  });
  return doc;
}

module.exports = { logAudit };
