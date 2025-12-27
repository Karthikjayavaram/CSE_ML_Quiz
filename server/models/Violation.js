const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    studentName: { type: String },
    type: { type: String, required: true }, // 'tab-switch', 'fullscreen-exit', etc.
    count: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Violation', violationSchema);
