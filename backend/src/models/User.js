const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: { type: String, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CANDIDATE },
    candidateId: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String, trim: true, maxlength: 20 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, discriminatorKey: 'role' }
);

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    username: this.username,
    role: this.role,
    candidateId: this.candidateId,
    phone: this.phone,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
