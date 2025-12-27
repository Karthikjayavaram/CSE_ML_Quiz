const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  techziteId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  branch: { type: String },
  status: { type: String, enum: ['active', 'blocked', 'completed', 'pending'], default: 'pending' },
  violationCount: { type: Number, default: 0 },
  lastViolation: { type: String },
  sessionId: { type: String },
  score: { type: Number, default: 0 },
  duration: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
