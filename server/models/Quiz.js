const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true },
    explanation: { type: String },
});

const quizSchema = new mongoose.Schema({
    title: { type: String, default: 'ML Quiz' },
    questions: [questionSchema],
    durationPerQuestion: { type: Number, default: 45 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
