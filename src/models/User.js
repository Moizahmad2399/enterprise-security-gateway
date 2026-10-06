const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, select: false },       // absent for OAuth-only users
  role: { type: String, enum: ['SuperAdmin', 'Manager', 'Employee'], default: 'Employee' },
  githubId: { type: String, unique: true, sparse: true },
  failedAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);
