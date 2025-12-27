const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    duration: { type: Number, required: true }, // in seconds
    answers: [{
        questionId: String,
        selectedOption: String,
        isCorrect: Boolean,
    }],
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
