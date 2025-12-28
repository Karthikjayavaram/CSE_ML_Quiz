require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const auth = require('basic-auth');
const Student = require('./models/Student');
const Quiz = require('./models/Quiz');
const Violation = require('./models/Violation');
const Result = require('./models/Result');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME
}).then(() => {
    console.log('Connected to MongoDB');
    seedDummyData();
}).catch(err => console.error('MongoDB connection error:', err));

// Admin Basic Auth Middleware
const adminAuth = (req, res, next) => {
    const credentials = auth(req);
    const expectedUser = (process.env.ADMIN_USERNAME || '').trim();
    const expectedPass = (process.env.ADMIN_PASSWORD || '').trim();

    if (!credentials || credentials.name !== expectedUser || credentials.pass !== expectedPass) {
        console.log(`[AUTH] Admin login failed.`);
        console.log(`[AUTH] Sent User: "${credentials?.name}", Expected: "${expectedUser}"`);
        console.log(`[AUTH] Password Match: ${credentials?.pass === expectedPass}`);
        res.set('WWW-Authenticate', 'Basic realm="example"');
        return res.status(401).send('Authentication required');
    }
    next();
};

// Seed Dummy Data
async function seedDummyData() {
    const studentCount = await Student.countDocuments();
    if (studentCount === 0) {
        const dummyStudents = [
            { techziteId: 'TZ2025001', name: 'John Doe', phone: '9876543210', email: 'john@example.com', branch: 'CSE', status: 'completed', score: 18, duration: 450 },
            { techziteId: 'TZ2025002', name: 'Jane Smith', phone: '8765432109', email: 'jane@example.com', branch: 'ECE', status: 'pending' },
            { techziteId: 'TZ2025003', name: 'Karthik V', phone: '1234567890', email: 'karthik@example.com', branch: 'AI', status: 'completed', score: 20, duration: 400 },
            { techziteId: 'TZ2025004', name: 'Alice Wong', phone: '5555555555', email: 'alice@example.com', branch: 'ML', status: 'blocked', violationCount: 2 }
        ];
        await Student.insertMany(dummyStudents);
        console.log('Comprehensive dummy students seeded');

        // Seed some results and violations for the seeded students
        const john = await Student.findOne({ techziteId: 'TZ2025001' });
        const karthik = await Student.findOne({ techziteId: 'TZ2025003' });
        const alice = await Student.findOne({ techziteId: 'TZ2025004' });
        const quiz = await Quiz.findOne();

        if (quiz) {
            await Result.create([
                { student: john._id, quiz: quiz._id, score: 18, totalQuestions: 20, duration: 450 },
                { student: karthik._id, quiz: quiz._id, score: 20, totalQuestions: 20, duration: 400 }
            ]);
            await Violation.create([
                { studentId: 'TZ2025004', studentName: 'Alice Wong', type: 'Tab Switch', count: 1, status: 'approved' },
                { studentId: 'TZ2025004', studentName: 'Alice Wong', type: 'Fullscreen Exit', count: 2, status: 'pending' }
            ]);
        }

        const quizCount = await Quiz.countDocuments();
        if (quizCount === 0) {
            const mlQuestions = require('./data/questions.json');
            await Quiz.create({ title: 'ML Technical Quiz', questions: mlQuestions });
            console.log('Dummy quiz seeded');
        }
    }
}

// Routes
app.post('/api/student/login', async (req, res) => {
    const { techziteId, phone } = req.body;
    try {
        const student = await Student.findOne({ techziteId, phone });
        if (!student) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const sessionId = student.sessionId || Math.random().toString(36).substring(7);
        student.sessionId = sessionId;

        // Strict One-Attempt Policy check
        const existingResult = await Result.findOne({ student: student._id });
        if (student.status === 'completed' || existingResult) {
            student.status = 'completed';
            await student.save();
            return res.status(403).json({ message: 'You have already completed the quiz. Multiple attempts are not allowed.' });
        }

        if (student.status !== 'completed' && student.status !== 'blocked') {
            student.status = 'active';
        }
        await student.save();
        res.json({ student, sessionId });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/student/status/:techziteId', async (req, res) => {
    try {
        const student = await Student.findOne({ techziteId: req.params.techziteId });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/quiz/active', async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ isActive: true });
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/quiz/submit', async (req, res) => {
    const { techziteId, score, duration, answers } = req.body;
    try {
        const student = await Student.findOne({ techziteId });
        const quiz = await Quiz.findOne({ isActive: true });

        const result = new Result({
            student: student._id,
            quiz: quiz._id,
            score,
            totalQuestions: quiz.questions.length,
            duration,
            answers
        });

        await result.save();
        student.status = 'completed';
        student.score = score;
        student.duration = duration;
        await student.save();

        res.json({ message: 'Quiz submitted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin Routes
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const expectedUser = (process.env.ADMIN_USERNAME || '').trim();
    const expectedPass = (process.env.ADMIN_PASSWORD || '').trim();

    if (username?.trim() === expectedUser && password?.trim() === expectedPass) {
        console.log(`[LOGIN SUCCESS] Admin logged in: ${username}`);
        return res.json({ success: true, auth: btoa(`${expectedUser}:${expectedPass}`) });
    } else {
        console.log(`[LOGIN FAILED] Attempt with: "${username}", Expected: "${expectedUser}"`);
        return res.status(401).json({ message: 'Invalid admin credentials' });
    }
});

app.get('/api/admin/violations', adminAuth, async (req, res) => {
    const violations = await Violation.find().sort({ createdAt: -1 });
    res.json(violations);
});

app.get('/api/admin/students', adminAuth, async (req, res) => {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
});

app.post('/api/admin/students/batch', adminAuth, async (req, res) => {
    const { students } = req.body;
    try {
        await Student.insertMany(students, { ordered: false });
        res.json({ message: 'Students uploaded successfully' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Some students already exist (Duplicate IDs)' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/admin/students/:id', adminAuth, async (req, res) => {
    try {
        await Student.findByIdAndDelete(req.params.id);
        res.json({ message: 'Student deleted' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.get('/api/admin/results', adminAuth, async (req, res) => {
    const results = await Result.find().populate('student').sort({ score: -1, duration: 1 });
    res.json(results);
});

app.delete('/api/admin/results/:id', adminAuth, async (req, res) => {
    try {
        const result = await Result.findById(req.params.id);
        if (result) {
            // Reset student status when result is deleted so they can re-take if needed
            await Student.findByIdAndUpdate(result.student, { status: 'pending', score: 0, duration: 0, violationCount: 0 });
            await Result.findByIdAndDelete(req.params.id);
        }
        res.json({ message: 'Result deleted and student status reset' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.delete('/api/admin/violations/:id', adminAuth, async (req, res) => {
    try {
        const violation = await Violation.findById(req.params.id);
        if (violation) {
            await Student.findOneAndUpdate(
                { techziteId: violation.studentId },
                { status: 'active', violationCount: 0 }
            );
            await Violation.findByIdAndDelete(req.params.id);
        }
        res.json({ message: 'Violation deleted and student status reset' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Generic Data fetch for Database Management
app.get('/api/admin/db/:collection', adminAuth, async (req, res) => {
    const { collection } = req.params;
    try {
        let data;
        switch (collection) {
            case 'students': data = await Student.find().sort({ createdAt: -1 }); break;
            case 'quizzes': data = await Quiz.find().sort({ createdAt: -1 }); break;
            case 'results': data = await Result.find().populate('student').sort({ createdAt: -1 }); break;
            case 'violations': data = await Violation.find().sort({ createdAt: -1 }); break;
            default: return res.status(400).send('Invalid collection');
        }
        res.json(data);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Generic Update Route for Database Management
app.put('/api/admin/db/:collection/:id', adminAuth, async (req, res) => {
    const { collection, id } = req.params;
    const updateData = req.body;
    try {
        let updated;
        switch (collection) {
            case 'students': updated = await Student.findByIdAndUpdate(id, updateData, { new: true }); break;
            case 'quizzes': updated = await Quiz.findByIdAndUpdate(id, updateData, { new: true }); break;
            case 'results': updated = await Result.findByIdAndUpdate(id, updateData, { new: true }); break;
            case 'violations': updated = await Violation.findByIdAndUpdate(id, updateData, { new: true }); break;
            default: return res.status(400).send('Invalid collection');
        }
        res.json(updated);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Generic Delete Route for Database Management
app.delete('/api/admin/db/:collection/:id', adminAuth, async (req, res) => {
    const { collection, id } = req.params;
    try {
        let deleted;
        switch (collection) {
            case 'students': deleted = await Student.findByIdAndDelete(id); break;
            case 'quizzes': deleted = await Quiz.findByIdAndDelete(id); break;
            case 'results':
                const result = await Result.findById(id);
                if (result) {
                    await Student.findByIdAndUpdate(result.student, { status: 'pending', score: 0, duration: 0, violationCount: 0 });
                }
                deleted = await Result.findByIdAndDelete(id);
                break;
            case 'violations':
                const violation = await Violation.findById(id);
                if (violation) {
                    await Student.findOneAndUpdate({ techziteId: violation.studentId }, { status: 'active', violationCount: 0 });
                }
                deleted = await Violation.findByIdAndDelete(id);
                break;
            default: return res.status(400).send('Invalid collection');
        }
        res.json({ message: `${collection} entry deleted successfully`, deleted });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Generic Create Route for Database Management
app.post('/api/admin/db/:collection', adminAuth, async (req, res) => {
    const { collection } = req.params;
    const data = req.body;
    try {
        let created;
        switch (collection) {
            case 'students': created = await Student.create(data); break;
            case 'quizzes': created = await Quiz.create(data); break;
            case 'results': created = await Result.create(data); break;
            case 'violations': created = await Violation.create(data); break;
            default: return res.status(400).send('Invalid collection');
        }
        res.json(created);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Manual Seed Endpoint - Force re-populate all collections with dummy data
app.post('/api/admin/seed', adminAuth, async (req, res) => {
    try {
        // Clear existing data
        await Student.deleteMany({});
        await Result.deleteMany({});
        await Violation.deleteMany({});
        await Quiz.deleteMany({});

        // Seed Students
        const dummyStudents = [
            { techziteId: 'TZ2025001', name: 'John Doe', phone: '9876543210', email: 'john@example.com', branch: 'CSE', status: 'completed', score: 18, duration: 450 },
            { techziteId: 'TZ2025002', name: 'Jane Smith', phone: '8765432109', email: 'jane@example.com', branch: 'ECE', status: 'pending' },
            { techziteId: 'TZ2025003', name: 'Karthik V', phone: '1234567890', email: 'karthik@example.com', branch: 'AI', status: 'completed', score: 20, duration: 400 },
            { techziteId: 'TZ2025004', name: 'Alice Wong', phone: '5555555555', email: 'alice@example.com', branch: 'ML', status: 'blocked', violationCount: 2 },
            { techziteId: 'TZ2025005', name: 'Bob Johnson', phone: '6666666666', email: 'bob@example.com', branch: 'DS', status: 'pending' },
            { techziteId: 'TZ2025006', name: 'Eve Williams', phone: '7777777777', email: 'eve@example.com', branch: 'CSE', status: 'active' }
        ];
        await Student.insertMany(dummyStudents);

        // Seed Quiz
        const mlQuestions = require('./data/questions.json');
        const quiz = await Quiz.create({ title: 'ML Technical Quiz', questions: mlQuestions, isActive: true });

        // Get created students
        const john = await Student.findOne({ techziteId: 'TZ2025001' });
        const karthik = await Student.findOne({ techziteId: 'TZ2025003' });

        // Seed Results
        await Result.create([
            { student: john._id, quiz: quiz._id, score: 18, totalQuestions: 20, duration: 450 },
            { student: karthik._id, quiz: quiz._id, score: 20, totalQuestions: 20, duration: 400 }
        ]);

        // Seed Violations
        await Violation.create([
            { studentId: 'TZ2025004', studentName: 'Alice Wong', type: 'Tab Switch', count: 1, status: 'approved' },
            { studentId: 'TZ2025004', studentName: 'Alice Wong', type: 'Fullscreen Exit', count: 2, status: 'pending' },
            { studentId: 'TZ2025006', studentName: 'Eve Williams', type: 'Tab Switch', count: 1, status: 'pending' }
        ]);

        res.json({
            message: 'Database seeded successfully!',
            counts: {
                students: 6,
                quizzes: 1,
                results: 2,
                violations: 3
            }
        });
    } catch (err) {
        console.error('Seed error:', err);
        res.status(500).json({ message: 'Seed failed', error: err.message });
    }
});

app.post('/api/admin/approve-violation', adminAuth, async (req, res) => {
    const { violationId, action } = req.body;
    try {
        const violation = await Violation.findById(violationId);
        if (!violation) return res.status(404).send('Violation not found');

        violation.status = action === 'approve' ? 'approved' : 'rejected';
        await violation.save();

        // Reset student violation count when approved
        if (action === 'approve') {
            await Student.findOneAndUpdate(
                { techziteId: violation.studentId },
                { violationCount: 0, lastViolation: null }
            );
        }

        io.to(violation.studentId).emit('violation-resolved', { action });
        res.json({ message: 'Violation updated' });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Socket.io for Real-time Monitoring
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', (studentId) => {
        socket.join(studentId);
        console.log(`Student ${studentId} joined room`);
    });

    socket.on('report-violation', async (data) => {
        const { techziteId, name, type, count } = data;
        console.log(`Server received violation for ${techziteId}: ${type}, count: ${count}`);

        await Student.findOneAndUpdate(
            { techziteId },
            { $inc: { violationCount: 1 }, lastViolation: new Date() }
        );

        const violation = new Violation({
            studentId: techziteId,
            studentName: name,
            type,
            count
        });
        await violation.save();

        io.emit('new-violation', violation);
        console.log(`Violation saved and broadcasted for ${techziteId}: ${type}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin login configured for user: ${(process.env.ADMIN_USERNAME || '').trim()}`);
});
