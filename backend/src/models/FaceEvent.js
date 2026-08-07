const mongoose = require('mongoose');

const faceEventSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSession', required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    faceStatus: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'MULTIPLE', 'LOOKING_AWAY', 'ERROR'],
      required: true,
      index: true,
    },
    faceCount: { type: Number, default: 0 },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    remark: { type: String, trim: true, maxlength: 300 },
    screenshotPath: { type: String },
  },
  { timestamps: true }
);

faceEventSchema.index({ session: 1, createdAt: 1 });

const FaceEvent = mongoose.model('FaceEvent', faceEventSchema);

module.exports = FaceEvent;
