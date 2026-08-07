const mongoose = require('mongoose');

const browserEventSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSession', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, trim: true, index: true },
    eventName: { type: String, trim: true },
    detail: { type: String, trim: true, maxlength: 300 },
    isViolation: { type: Boolean, default: false },
    screenshotPath: { type: String },
  },
  { timestamps: true }
);

browserEventSchema.index({ session: 1, createdAt: 1 });

const BrowserEvent = mongoose.model('BrowserEvent', browserEventSchema);

module.exports = BrowserEvent;
