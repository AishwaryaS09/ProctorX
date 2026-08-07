const mongoose = require('mongoose');

const { SEVERITY, VIOLATION_POINTS } = require('../config/constants');

const violationSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSession', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.keys(VIOLATION_POINTS), required: true, index: true },
    points: { type: Number, required: true },
    severity: { type: String, enum: Object.values(SEVERITY), required: true },
    message: { type: String, trim: true, maxlength: 300 },
    warningLevel: { type: Number, default: 0 },
    screenshotPath: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

violationSchema.index({ session: 1, createdAt: 1 });

const Violation = mongoose.model('Violation', violationSchema);

module.exports = Violation;
