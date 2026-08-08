const mongoose = require('mongoose');

const { SESSION_STATUS } = require('../config/constants');

const examSessionSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    examName: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.ACTIVE,
      index: true,
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    currentRisk: { type: String, default: 'LOW' },
    violationCount: { type: Number, default: 0 },
    warningLevel: { type: Number, default: 0 },
    /** Per-face-state frame counters. Single source of truth: every analysed
     *  frame increments exactly one of these four counters. */
    facePresentCount: { type: Number, default: 0, min: 0 },
    faceAbsentCount: { type: Number, default: 0, min: 0 },
    faceMultipleCount: { type: Number, default: 0, min: 0 },
    faceLookingAwayCount: { type: Number, default: 0, min: 0 },
    /** Cumulative browser-related counters (mirrored by Violation documents). */
    browserViolationCount: { type: Number, default: 0, min: 0 },
    fullscreenExitCount: { type: Number, default: 0, min: 0 },
    autoEnded: { type: Boolean, default: false },
    finalRemarks: { type: String, trim: true, maxlength: 500 },
    deviceInfo: {
      userAgent: { type: String, default: '' },
      screenSize: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

examSessionSchema.index({ candidate: 1, createdAt: -1 });

const ExamSession = mongoose.model('ExamSession', examSessionSchema);

module.exports = ExamSession;
