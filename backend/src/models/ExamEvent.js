const mongoose = require('mongoose');

/**
 * User-facing positive lifecycle events for an exam session.
 * Violations live in the Violation collection; this collection holds the
 * GREEN events (permissions approved, face detected, monitoring active) so
 * the result page can render a single persisted timeline.
 */
const examEventSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSession', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

examEventSchema.index({ session: 1, createdAt: 1 });

const ExamEvent = mongoose.model('ExamEvent', examEventSchema);

module.exports = ExamEvent;
