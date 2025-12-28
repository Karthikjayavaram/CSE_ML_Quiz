const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Quiz = require('../models/Quiz');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: process.env.DB_NAME
        });
        console.log('Connected to MongoDB');

        const questionsPath = path.join(__dirname, '../data/questions.json');
        const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

        // Update existing active quiz or create new one
        let quiz = await Quiz.findOne({ isActive: true });

        if (quiz) {
            console.log(`Updating existing quiz: ${quiz.title}`);
            quiz.questions = questionsData;
            await quiz.save();
        } else {
            console.log('No active quiz found. Creating new one...');
            quiz = new Quiz({
                title: 'ML Quiz',
                questions: questionsData,
                isActive: true
            });
            await quiz.save();
        }

        console.log(`Successfully seeded ${questionsData.length} questions.`);
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seed();
