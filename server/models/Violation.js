const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    type: { type: String, required: true },
    count: { type: Number, default: 1 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Violation', violationSchema);
