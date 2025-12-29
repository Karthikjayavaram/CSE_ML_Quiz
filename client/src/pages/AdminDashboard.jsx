import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuiz } from '../context/QuizContext';
import { LayoutDashboard, Users, AlertTriangle, Trophy, Search, RefreshCw, Check, X } from 'lucide-react';
import config from '../config';

const DynamicTable = ({ data, onEdit, onDelete, showDelete = true }) => {
    if (!data || data.length === 0) return <div className="p-20 text-center glass card">No data found in this collection.</div>;
    
    const headers = Object.keys(data[0]).filter(k => !['_id', '__v'].includes(k));

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const renderValue = (key, val) => {
        if (val === undefined || val === null) return '-';
        
        // Format dates
        if (['createdAt', 'updatedAt', 'timestamp', 'lastViolation'].includes(key)) {
            return formatDate(val);
        }
        
        // Format status with badges
        if (key === 'status') {
            const statusColors = {
                completed: 'success',
                active: 'warning',
                pending: 'info',
                blocked: 'error',
                approved: 'success',
                rejected: 'error'
            };
            return <span className={`status-badge ${statusColors[val] || ''}`}>{val}</span>;
        }
        
        // Handle objects
        if (typeof val === 'object') {
            if (val.name) return val.name; // For populated students
            if (val.techziteId) return val.techziteId;
            if (Array.isArray(val)) return `[${val.length} items]`;
            return <pre className="json-sm">{JSON.stringify(val, null, 2)}</pre>;
        }
        
        // Truncate long strings
        const str = String(val);
        if (str.length > 50) return str.substring(0, 47) + '...';
        return str;
    };

    return (
        <div className="results-table card glass overflow-auto">
            <table>
                <thead>
                    <tr>
                        {headers.map(h => <th key={h}>{h.toUpperCase()}</th>)}
                        <th>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item) => (
                        <tr key={item._id}>
                            {headers.map(h => (
                                <td key={h}>{renderValue(h, item[h])}</td>
                            ))}
                            <td className="actions-cell">
                                <button className="edit-btn sm" onClick={() => onEdit(item)}>EDIT</button>
                                {showDelete && <button className="reject-btn sm" onClick={() => onDelete(item._id)}>DELETE</button>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('monitoring');
    const [violations, setViolations] = useState([]);
    const [students, setStudents] = useState([]);
    const [highViolationStudents, setHighViolationStudents] = useState([]);
    const [results, setResults] = useState([]);
    const [dbData, setDbData] = useState([]);
    const [selectedCollection, setSelectedCollection] = useState('students');
    const [loading, setLoading] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [showQuestionModal, setShowQuestionModal] = useState({ show: false, quizId: null, questionIndex: null });
    const [questionForm, setQuestionForm] = useState({ question: '', options: ['', '', '', ''], correctAnswer: '', explanation: '' });
    const [addForm, setAddForm] = useState({});
    const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null, type: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [socketConnected, setSocketConnected] = useState(false);
    const { socket, logout } = useQuiz();
    const navigate = useNavigate();

    useEffect(() => {
        if (socket) {
            setSocketConnected(socket.connected);
            socket.on('connect', () => setSocketConnected(true));
            socket.on('disconnect', () => setSocketConnected(false));
            
            socket.on('new-violation', (violation) => {
                if (violation.status === 'pending') {
                    setViolations(prev => [violation, ...prev]);
                }
            });
        }
        return () => {
            if (socket) {
                socket.off('connect');
                socket.off('disconnect');
                socket.off('new-violation');
            }
        };
    }, [socket]);

    if (!localStorage.getItem('adminAuth')) {
        return null;
    }

    const auth = localStorage.getItem('adminAuth');
    const headers = { Authorization: `Basic ${auth}` };
    const API_BASE = config.API_BASE;

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'monitoring') {
                const resp = await axios.get(`${API_BASE}/admin/violations`, { headers });
                setViolations(resp.data.filter(v => v.status === 'pending'));
            } else if (activeTab === 'management') {
                const resp = await axios.get(`${API_BASE}/admin/students`, { headers });
                setStudents(resp.data);
                setHighViolationStudents(resp.data.filter(s => s.violationCount > 2));
            } else if (activeTab === 'results') {
                const resp = await axios.get(`${API_BASE}/admin/results`, { headers });
                setResults(resp.data);
            } else if (activeTab === 'database') {
                const resp = await axios.get(`${API_BASE}/admin/db/${selectedCollection}`, { headers });
                setDbData(resp.data);
            }
        } catch (err) {
            console.error("Fetch failed", err);
            if (err.response?.status === 401) {
                logout();
                navigate('/admin-login');
            }
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch data when component mounts or when tab/collection changes
    useEffect(() => {
        fetchData();
    }, [activeTab, selectedCollection]);

    const handleApprove = async (id, action) => {
        try {
            await axios.post(`${API_BASE}/admin/approve-violation`, { violationId: id, action }, { headers });
            setViolations(prev => prev.filter(v => v._id !== id));
        } catch (err) {
            alert("Approval failed");
        }
    };

    const handleDeleteResult = async (id) => {
        if (!window.confirm("Delete this result? This will reset the student's status and violation count, allowing them to re-take the quiz.")) return;
        try {
            await axios.delete(`${API_BASE}/admin/results/${id}`, { headers });
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Delete failed: " + (err.response?.data?.message || err.message));
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setEditForm(item);
    };

    const handleSaveEdit = async () => {
        try {
            await axios.put(`${API_BASE}/admin/db/${selectedCollection}/${editingItem._id}`, editForm, { headers });
            setEditingItem(null);
            fetchData();
        } catch (err) {
            alert("Update failed");
        }
    };

    const handleAddQuestion = async () => {
        const activeQuiz = dbData.find(q => q.isActive) || dbData[0];
        if (!activeQuiz) return alert("No quiz found to add questions to.");
        
        const newQuestion = {
            question: "New Question Text",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: "Option A",
            explanation: ""
        };
        
        const updatedQuestions = [...activeQuiz.questions, newQuestion];
        try {
            await axios.put(`${API_BASE}/admin/db/quizzes/${activeQuiz._id}`, { questions: updatedQuestions }, { headers });
            fetchData();
            alert("Question added! You can now edit it.");
        } catch (err) {
            alert("Failed to add question");
        }
    };

    const handleSaveQuestion = async () => {
        const quiz = dbData.find(q => q._id === showQuestionModal.quizId);
        if (!quiz) return;

        let updatedQuestions = [...quiz.questions];
        if (showQuestionModal.questionIndex !== null) {
            updatedQuestions[showQuestionModal.questionIndex] = questionForm;
        } else {
            updatedQuestions.push(questionForm);
        }

        try {
            await axios.put(`${API_BASE}/admin/db/quizzes/${quiz._id}`, { questions: updatedQuestions }, { headers });
            setShowQuestionModal({ show: false, quizId: null, questionIndex: null });
            fetchData();
        } catch (err) {
            alert("Failed to save question");
        }
    };

    const handleDeleteQuestion = async (quizId, qIndex) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;
        const quiz = dbData.find(q => q._id === quizId);
        const updatedQuestions = quiz.questions.filter((_, i) => i !== qIndex);
        
        try {
            await axios.put(`${API_BASE}/admin/db/quizzes/${quiz._id}`, { questions: updatedQuestions }, { headers });
            fetchData();
        } catch (err) {
            alert("Failed to delete question");
        }
    };

    return (
        <div className="admin-dashboard fade-in">
            <div className="admin-sidebar glass">
                <h2 className="neon-text">CONTROL HUB</h2>
                <nav>
                    <button className={activeTab === 'monitoring' ? 'active' : ''} onClick={() => setActiveTab('monitoring')}>
                        <AlertTriangle size={20} /> LIVE MONITORING
                    </button>
                    <button className={activeTab === 'management' ? 'active' : ''} onClick={() => setActiveTab('management')}>
                        <Users size={20} /> MANAGEMENT
                    </button>
                    <button className={activeTab === 'results' ? 'active' : ''} onClick={() => setActiveTab('results')}>
                        <Trophy size={20} /> RESULTS
                    </button>
                    <button className={activeTab === 'database' ? 'active' : ''} onClick={() => setActiveTab('database')}>
                        <LayoutDashboard size={20} /> DATABASE
                    </button>
                </nav>
            </div>

            <div className="admin-main">
                <header className="admin-header glass">
                    <h1>{activeTab.toUpperCase()}</h1>
                    <div className="header-actions">
                        <div className={`socket-status ${socketConnected ? 'connected' : 'disconnected'}`}>
                            {socketConnected ? '● MONITORING LIVE' : '○ DISCONNECTED'}
                        </div>
                        <button onClick={fetchData} className="refresh-btn">
                            <RefreshCw size={18} className={loading ? 'spinning' : ''} /> Refresh
                        </button>
                        <button onClick={() => { logout(); navigate('/admin-login'); }} className="logout-btn">
                            LOGOUT
                        </button>
                    </div>
                </header>

                <div className="admin-content">
                    {activeTab === 'monitoring' && (
                        <div className="violation-list">
                            {violations.length === 0 ? (
                                <div className="empty-state">No pending approvals required.</div>
                            ) : (
                                violations.map(v => (
                                    <div key={v._id} className="violation-item card glass">
                                        <div className="v-info">
                                            <h3>{v.studentName} <span className="v-id">({v.studentId})</span></h3>
                                            <p className="v-type">VIOLATION: <span className="error">{v.type}</span></p>
                                            <p className="v-count">Count: <strong>{v.count}</strong></p>
                                        </div>
                                        <div className="v-actions">
                                            <button className="approve-btn" onClick={() => handleApprove(v._id, 'approve')}>
                                                <Check size={18} /> APPROVE
                                            </button>
                                            <button className="reject-btn" onClick={() => handleApprove(v._id, 'reject')}>
                                                <X size={18} /> TERMINATE
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'results' && (
                        <div className="results-container">
                            <div className="action-header">
                                <button className="btn-primary" onClick={async () => {
                                    const ExcelJS = await import('exceljs');
                                    const workbook = new ExcelJS.Workbook();
                                    const worksheet = workbook.addWorksheet('Results');
                                    worksheet.columns = [
                                        { header: 'Rank', key: 'rank', width: 10 },
                                        { header: 'Name', key: 'name', width: 25 },
                                        { header: 'Techzite ID', key: 'techziteId', width: 20 },
                                        { header: 'Email', key: 'email', width: 30 },
                                        { header: 'Score', key: 'score', width: 10 },
                                        { header: 'Duration (s)', key: 'duration', width: 15 }
                                    ];
                                    results.forEach((r, i) => {
                                        worksheet.addRow({
                                            rank: i + 1,
                                            name: r.student?.name,
                                            techziteId: r.student?.techziteId,
                                            email: r.student?.email,
                                            score: r.score,
                                            duration: r.duration
                                        });
                                    });
                                    const buffer = await workbook.xlsx.writeBuffer();
                                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                    const link = document.createElement('a');
                                    link.href = window.URL.createObjectURL(blob);
                                    link.download = 'ML_Quiz_Results.xlsx';
                                    link.click();
                                }}>
                                    EXPORT TO EXCEL
                                </button>
                            </div>
                            <div className="results-table card glass mt-20">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Name</th>
                                            <th>ID</th>
                                            <th>Score</th>
                                            <th>Duration</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((r, i) => (
                                            <tr key={r._id}>
                                                <td>{i + 1}</td>
                                                <td>{r.student?.name}</td>
                                                <td>{r.student?.techziteId}</td>
                                                <td className="score-cell">{r.score}</td>
                                                <td>{r.duration}s</td>
                                                <td>
                                                    <button className="reject-btn sm" onClick={() => {
                                                        setConfirmDelete({ 
                                                             show: true, 
                                                             id: r._id, 
                                                             type: 'result',
                                                             msg: `Are you sure you want to delete the results for ${r.student?.name}? This will allow the student to retake the quiz.`
                                                         });
                                                    }}>DELETE RESULT</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'management' && (
                        <div className="student-management">
                            {highViolationStudents.length > 0 && (
                                <div className="card glass mb-20 alert-section" style={{ borderLeft: '4px solid var(--error)' }}>
                                    <h3 className="error" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <AlertTriangle size={24} /> INTIMATE ADMIN: CRITICAL VIOLATIONS
                                    </h3>
                                    <p className="mb-10">Students with more than 2 violations detected. Immediate action may be required.</p>
                                    <div className="violation-alerts">
                                        {highViolationStudents.map(s => (
                                            <div key={s._id} className="alert-item glass py-10 px-15 mb-10" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '8px' }}>
                                                <div>
                                                    <strong>{s.name}</strong> ({s.techziteId}) - <span className="error">{s.violationCount} Violations</span>
                                                </div>
                                                <button className="reject-btn sm" onClick={async () => {
                                                    if (window.confirm(`Block ${s.name} from the quiz?`)) {
                                                        await axios.put(`${API_BASE}/admin/db/students/${s._id}`, { status: 'blocked' }, { headers });
                                                        fetchData();
                                                    }
                                                }}>BLOCK STUDENT</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="card glass upload-section">
                                <h3><Users size={20} /> Batch Student Upload</h3>
                                <p>Upload an Excel file (.xlsx) with columns: <strong>techziteId, name, phone, email, branch</strong></p>
                                <div className="file-input-wrapper">
                                    <input
                                        type="file"
                                        accept=".xlsx"
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (!file) return;

                                            const ExcelJS = await import('exceljs');
                                            const workbook = new ExcelJS.Workbook();
                                            await workbook.xlsx.load(file);
                                            const worksheet = workbook.getWorksheet(1);
                                            const studentsData = [];

                                            worksheet.eachRow((row, rowNumber) => {
                                                if (rowNumber > 1) { // Skip header
                                                    studentsData.push({
                                                        techziteId: row.getCell(1).text,
                                                        name: row.getCell(2).text,
                                                        phone: row.getCell(3).text,
                                                        email: row.getCell(4).text,
                                                        branch: row.getCell(5).text
                                                    });
                                                }
                                            });

                                            try {
                                                await axios.post(`${API_BASE}/admin/students/batch`, { students: studentsData }, { headers });
                                                alert("Students uploaded successfully!");
                                                fetchData();
                                            } catch (err) {
                                                alert("Upload failed: " + (err.response?.data?.message || err.message));
                                            }
                                        }}
                                    />
                                    <div className="btn-upload">SELECT EXCEL FILE</div>
                                </div>
                            </div>

                            <div className="results-table card glass mt-20">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Techzite ID</th>
                                            <th>Phone</th>
                                            <th>Email</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map(s => (
                                            <tr key={s._id}>
                                                <td>{s.name}</td>
                                                <td>{s.techziteId}</td>
                                                <td>{s.phone}</td>
                                                <td>{s.email}</td>
                                                <td>
                                                    <button className="reject-btn sm" onClick={async () => {
                                                        if (window.confirm("Delete this student?")) {
                                                            await axios.delete(`${API_BASE}/admin/students/${s._id}`, { headers });
                                                            fetchData();
                                                        }
                                                    }}>DELETE</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'database' && (
                        <div className="db-management">
                            {selectedCollection === 'students' && (
                                <div className="search-bar card glass mb-20">
                                    <div className="search-input-wrapper">
                                        <Search size={20} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search students by name, ID, phone, email, or branch..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="search-input"
                                        />
                                        {searchQuery && (
                                            <button 
                                                className="clear-search" 
                                                onClick={() => setSearchQuery('')}
                                                aria-label="Clear search"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <div className="db-controls card glass mb-20">
                                <select 
                                    className="db-select" 
                                    value={selectedCollection} 
                                    onChange={(e) => {
                                        setSelectedCollection(e.target.value);
                                        setSearchQuery(''); // Clear search when changing collections
                                    }}
                                >
                                    <option value="students">Students Collection</option>
                                    <option value="quizzes">Quizzes Collection</option>
                                    <option value="results">Results Collection</option>
                                    <option value="violations">Violations Collection</option>
                                </select>
                                <p className="db-info">Showing all raw data from <strong>{selectedCollection}</strong> collection.</p>
                                {selectedCollection === 'quizzes' && (
                                    <button className="btn-primary sm mb-10" onClick={handleAddQuestion}>+ ADD QUESTION TO ACTIVE QUIZ</button>
                                )}
                            </div>

                            <div className="db-actions mb-20">
                                <button className="btn-primary" onClick={() => {
                                    setShowAddModal(true);
                                    setAddForm({});
                                }}>+ ADD NEW {selectedCollection.slice(0, -1).toUpperCase()}</button>
                            </div>

                            <div className="db-content">
                                {selectedCollection === 'quizzes' ? (
                                    <div className="quizzes-manager">
                                        {dbData.length === 0 ? (
                                            <div className="p-20 text-center glass card">No quizzes found. Please seed the database or add a new quiz.</div>
                                        ) : (
                                            dbData.map(quiz => (
                                                <div key={quiz._id} className="quiz-card card glass mb-20">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                                        <h3>{quiz.title} {quiz.isActive && <span className="status-badge success">ACTIVE</span>}</h3>
                                                        <button className="btn-primary sm" onClick={() => {
                                                            setShowQuestionModal({ show: true, quizId: quiz._id, questionIndex: null });
                                                            setQuestionForm({ question: '', options: ['', '', '', ''], correctAnswer: '', explanation: '' });
                                                        }}>+ NEW QUESTION</button>
                                                    </div>
                                                    <div className="questions-list">
                                                        {quiz.questions.map((q, idx) => (
                                                            <div key={idx} className="question-item glass p-15 mb-10" style={{ borderLeft: '3px solid var(--primary)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <p><strong>Q{idx + 1}:</strong> {q.question}</p>
                                                                    <div className="actions">
                                                                        <button className="edit-btn sm mr-5" onClick={() => {
                                                                            setShowQuestionModal({ show: true, quizId: quiz._id, questionIndex: idx });
                                                                            setQuestionForm(q);
                                                                        }}>EDIT</button>
                                                                        <button className="reject-btn sm" onClick={() => handleDeleteQuestion(quiz._id, idx)}>DELETE</button>
                                                                    </div>
                                                                </div>
                                                                <div className="options-grid mt-10" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '0.85rem' }}>
                                                                    {q.options.map((opt, i) => (
                                                                        <div key={i} className={opt === q.correctAnswer ? 'success' : 'text-secondary'}>
                                                                            {String.fromCharCode(65 + i)}) {opt} {opt === q.correctAnswer && <Check size={14} style={{ display: 'inline' }} />}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <DynamicTable 
                                        data={selectedCollection === 'students' && searchQuery 
                                            ? dbData.filter(student => {
                                                const query = searchQuery.toLowerCase();
                                                return (
                                                    student.name?.toLowerCase().includes(query) ||
                                                    student.techziteId?.toLowerCase().includes(query) ||
                                                    student.phone?.toLowerCase().includes(query) ||
                                                    student.email?.toLowerCase().includes(query) ||
                                                    student.branch?.toLowerCase().includes(query)
                                                );
                                            })
                                            : dbData
                                        } 
                                        onEdit={handleEdit}
                                        showDelete={selectedCollection !== 'results'}
                                        onDelete={async (id) => {
                                            if (window.confirm("Delete this entry?")) {
                                                try {
                                                    await axios.delete(`${API_BASE}/admin/db/${selectedCollection}/${id}`, { headers });
                                                    fetchData();
                                                } catch (err) {
                                                    alert('Delete failed: ' + (err.response?.data?.message || err.message));
                                                }
                                            }
                                        }} 
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Question Management Modal */}
            {showQuestionModal.show && (
                <div className="modal-overlay glass">
                    <div className="card glass modal-content">
                        <h2>{showQuestionModal.questionIndex !== null ? 'Edit Question' : 'Add New Question'}</h2>
                        <div className="edit-form">
                            <div className="input-group">
                                <label>Question Text</label>
                                <textarea 
                                    value={questionForm.question} 
                                    onChange={(e) => setQuestionForm({...questionForm, question: e.target.value})}
                                    style={{ height: '80px' }}
                                />
                            </div>
                            <div className="options-input" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                {questionForm.options.map((opt, i) => (
                                    <div key={i} className="input-group">
                                        <label>Option {String.fromCharCode(65 + i)}</label>
                                        <input 
                                            type="text" 
                                            value={opt} 
                                            onChange={(e) => {
                                                const newOpts = [...questionForm.options];
                                                newOpts[i] = e.target.value;
                                                setQuestionForm({...questionForm, options: newOpts});
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="input-group">
                                <label>Correct Answer</label>
                                <select 
                                    className="db-select" 
                                    style={{ maxWidth: '100%' }}
                                    value={questionForm.correctAnswer}
                                    onChange={(e) => setQuestionForm({...questionForm, correctAnswer: e.target.value})}
                                >
                                    <option value="">Select Correct Option</option>
                                    {questionForm.options.map((opt, i) => (
                                        <option key={i} value={opt}>{String.fromCharCode(65 + i)}) {opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Explanation (Optional)</label>
                                <input 
                                    type="text" 
                                    value={questionForm.explanation} 
                                    onChange={(e) => setQuestionForm({...questionForm, explanation: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={handleSaveQuestion}>SAVE QUESTION</button>
                            <button className="btn-secondary" onClick={() => setShowQuestionModal({ show: false, quizId: null, questionIndex: null })}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingItem && (
                <div className="modal-overlay glass">
                    <div className="card glass modal-content">
                        <h2>Edit {selectedCollection.slice(0, -1)}</h2>
                        <div className="edit-form">
                            {Object.keys(editForm).filter(k => !['_id', '__v', 'createdAt', 'updatedAt'].includes(k)).map(key => (
                                <div key={key} className="input-group">
                                    <label>{key}</label>
                                    {typeof editForm[key] === 'object' ? (
                                        <textarea 
                                            value={JSON.stringify(editForm[key], null, 2)}
                                            onChange={(e) => {
                                                try {
                                                    setEditForm({...editForm, [key]: JSON.parse(e.target.value)});
                                                } catch(err) {}
                                            }}
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={editForm[key]} 
                                            onChange={(e) => setEditForm({...editForm, [key]: e.target.value})}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={handleSaveEdit}>SAVE CHANGES</button>
                            <button className="btn-secondary" onClick={() => setEditingItem(null)}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay glass">
                    <div className="card glass modal-content">
                        <h2>Add New {selectedCollection.slice(0, -1)}</h2>
                        <div className="edit-form">
                            {selectedCollection === 'students' && (
                                <>
                                    <div className="input-group">
                                        <label>TechZite ID</label>
                                        <input type="text" value={addForm.techziteId || ''} onChange={(e) => setAddForm({...addForm, techziteId: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                        <label>Name</label>
                                        <input type="text" value={addForm.name || ''} onChange={(e) => setAddForm({...addForm, name: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                        <label>Phone</label>
                                        <input type="text" value={addForm.phone || ''} onChange={(e) => setAddForm({...addForm, phone: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                        <label>Email</label>
                                        <input type="text" value={addForm.email || ''} onChange={(e) => setAddForm({...addForm, email: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                        <label>Branch</label>
                                        <input type="text" value={addForm.branch || ''} onChange={(e) => setAddForm({...addForm, branch: e.target.value})} />
                                    </div>
                                </>
                            )}
                            {selectedCollection === 'violations' && (
                                <>
                                    <div className="input-group">
                                        <label>Student ID</label>
                                        <input type="text" value={addForm.studentId || ''} onChange={(e) => setAddForm({...addForm, studentId: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                        <label>Student Name</label>
                                        <input type="text" value={addForm.studentName || ''} onChange={(e) => setAddForm({...addForm, studentName: e.target.value})} />
                                    </div>
                                    <div className="input-group">
                                        <label>Type</label>
                                        <input type="text" value={addForm.type || ''} onChange={(e) => setAddForm({...addForm, type: e.target.value})} placeholder="e.g., Tab Switch" />
                                    </div>
                                    <div className="input-group">
                                        <label>Count</label>
                                        <input type="number" value={addForm.count || 1} onChange={(e) => setAddForm({...addForm, count: parseInt(e.target.value)})} />
                                    </div>
                                </>
                            )}
                            {selectedCollection === 'quizzes' && (
                                <p className="info-text">For quizzes, please use the "ADD QUESTION" button or edit existing quizzes.</p>
                            )}
                            {selectedCollection === 'results' && (
                                <p className="info-text">Results are automatically created when students submit quizzes.</p>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={async () => {
                                try {
                                    await axios.post(`${API_BASE}/admin/db/${selectedCollection}`, addForm, { headers });
                                    setShowAddModal(false);
                                    fetchData();
                                    alert('Entry added successfully!');
                                } catch (err) {
                                    alert('Add failed: ' + (err.response?.data?.message || err.message));
                                }
                            }}>ADD</button>
                            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmDelete.show && (
                <div className="modal-overlay glass">
                    <div className="card glass modal-content confirmation-modal">
                        <AlertTriangle size={48} className="icon-warning mb-20" />
                        <h2>Confirm Deletion</h2>
                        <p className="mb-20">{confirmDelete.msg}</p>
                        <div className="modal-actions">
                            <button className="reject-btn" onClick={async () => {
                                try {
                                    if (confirmDelete.type === 'result') {
                                        await axios.delete(`${API_BASE}/admin/results/${confirmDelete.id}`, { headers });
                                    } else if (confirmDelete.type === 'student') {
                                        await axios.delete(`${API_BASE}/admin/students/${confirmDelete.id}`, { headers });
                                    }
                                    setConfirmDelete({ show: false, id: null, type: null });
                                    fetchData();
                                } catch (err) {
                                    alert('Deletion failed: ' + (err.response?.data?.message || err.message));
                                }
                            }}>YES, DELETE</button>
                            <button className="btn-secondary" onClick={() => setConfirmDelete({ show: false, id: null, type: null })}>CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

      <style jsx="true">{`
        .admin-dashboard { display: flex; min-height: 100vh; background: #05060a; }
        .admin-sidebar { width: 280px; padding: 40px 20px; border-right: 1px solid rgba(255, 255, 255, 0.05); }
        .admin-sidebar h2 { font-size: 1.2rem; margin-bottom: 40px; text-align: center; }
        .admin-sidebar nav { display: flex; flex-direction: column; gap: 10px; }
        .admin-sidebar nav button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 15px;
          background: transparent;
          color: var(--text-secondary);
          text-align: left;
          border: 1px solid transparent;
        }
        .admin-sidebar nav button:hover { background: rgba(255, 255, 255, 0.05); }
        .admin-sidebar nav button.active {
          background: rgba(112, 0, 255, 0.1);
          border-color: var(--secondary);
          color: white;
        }
        .admin-main { flex: 1; padding: 40px; overflow-y: auto; }
        .admin-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-radius: 12px; margin-bottom: 30px; }
        .admin-header h1 { font-size: 1.5rem; letter-spacing: 2px; }
        .header-actions { display: flex; gap: 10px; align-items: center; }
        .logout-btn { background: rgba(255, 68, 68, 0.1); color: var(--error); border: 1px solid var(--error); padding: 8px 16px; font-size: 0.9rem; font-weight: 700; border-radius: 8px; }
        .logout-btn:hover { background: var(--error); color: white; }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .violation-list { display: flex; flex-direction: column; gap: 20px; }
        .violation-item { display: flex; justify-content: space-between; align-items: center; padding: 25px; border-left: 4px solid var(--error); }
        .v-info h3 { margin-bottom: 8px; }
        .v-id { font-size: 0.9rem; color: var(--text-secondary); }
        .v-type { color: var(--text-secondary); }
        .error { color: var(--error); font-weight: 700; }
        .v-actions { display: flex; gap: 15px; }
        .approve-btn { background: var(--success); color: var(--bg-dark); display: flex; align-items: center; gap: 8px; padding: 10px 20px; }
        .reject-btn { background: var(--error); color: white; display: flex; align-items: center; gap: 8px; padding: 10px 20px; }
        
        .results-table table { width: 100%; border-collapse: collapse; }
        .results-table th, .results-table td { padding: 15px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .score-cell { font-weight: 700; color: var(--primary); font-size: 1.2rem; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
        .status-badge.completed, .status-badge.success { background: rgba(0, 255, 136, 0.1); color: var(--success); }
        .status-badge.active, .status-badge.warning { background: rgba(255, 193, 7, 0.1); color: #ffc107; }
        .status-badge.pending, .status-badge.info { background: rgba(33, 150, 243, 0.1); color: #2196f3; }
        .status-badge.blocked, .status-badge.error { background: rgba(255, 0, 85, 0.1); color: var(--error); }
        .reject-btn.sm { padding: 4px 12px; font-size: 0.8rem; }
        .mt-20 { margin-top: 20px; }
        .socket-status { font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 4px; display: flex; align-items: center; gap: 5px; }
        .socket-status.connected { background: rgba(0, 255, 136, 0.1); color: var(--success); }
        .socket-status.disconnected { background: rgba(255, 68, 68, 0.1); color: var(--error); }
        .upload-section { margin-bottom: 20px; }
        .upload-section h3 { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .file-input-wrapper { position: relative; display: inline-block; margin-top: 15px; }
        .file-input-wrapper input { position: absolute; left: 0; top: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
        .btn-upload { background: var(--primary); color: var(--bg-dark); padding: 10px 20px; border-radius: 8px; font-weight: 700; }
        .mb-20 { margin-bottom: 20px; }
        .db-select { background: var(--bg-dark); color: white; border: 1px solid var(--primary); padding: 10px; border-radius: 8px; width: 100%; max-width: 300px; margin-bottom: 15px; }
        .json-display { background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px; font-size: 0.85rem; color: var(--success); overflow-x: auto; max-width: 800px; }
        .json-sm { font-size: 0.75rem; color: var(--success); margin: 0; white-space: pre-wrap; word-break: break-all; max-width: 200px; }
        .overflow-auto { overflow: auto; }
        .actions-cell { display: flex; gap: 8px; }
        .edit-btn { background: var(--warning); color: var(--bg-dark); }
        .edit-btn.sm { padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.8); }
        .modal-content { width: 90%; max-width: 600px; padding: 30px; border: 1px solid var(--primary); max-height: 90vh; overflow-y: auto; }
        .edit-form { margin: 20px 0; display: flex; flex-direction: column; gap: 15px; }
        .edit-form .input-group { display: flex; flex-direction: column; gap: 5px; }
        .edit-form label { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; }
        .edit-form input, .edit-form textarea { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px; border-radius: 6px; }
        .edit-form textarea { height: 150px; font-family: monospace; }
        .modal-actions { display: flex; gap: 15px; justify-content: flex-end; }
        .mb-10 { margin-bottom: 10px; }
        .icon-warning { color: var(--warning); display: block; margin: 0 auto; }
        .confirmation-modal { text-align: center; max-width: 450px; }
        .confirmation-modal p { color: var(--text-secondary); line-height: 1.5; }
        .db-actions { display: flex; gap: 15px; margin-bottom: 20px; }
        .btn-secondary { background: rgba(255, 255, 255, 0.1); color: white; padding: 10px 20px; border: 1px solid rgba(255, 255, 255, 0.2); }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
        .info-text { color: var(--text-secondary); font-style: italic; padding: 20px; text-align: center; }
        
        /* Search Bar Styles */
        .search-bar { padding: 20px; }
        .search-input-wrapper { 
          position: relative; 
          display: flex; 
          align-items: center; 
          width: 100%;
        }
        .search-icon { 
          position: absolute; 
          left: 15px; 
          color: var(--text-secondary); 
          pointer-events: none;
          z-index: 1;
        }
        .search-input { 
          width: 100%; 
          padding: 12px 45px 12px 45px; 
          background: rgba(255, 255, 255, 0.05); 
          border: 1px solid rgba(255, 255, 255, 0.1); 
          border-radius: 8px; 
          color: white; 
          font-size: 0.95rem;
          transition: all 0.3s ease;
        }
        .search-input:focus { 
          outline: none; 
          border-color: var(--primary); 
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 3px rgba(112, 0, 255, 0.1);
        }
        .search-input::placeholder { 
          color: var(--text-secondary); 
          opacity: 0.6;
        }
        .clear-search { 
          position: absolute; 
          right: 12px; 
          background: rgba(255, 255, 255, 0.1); 
          border: none; 
          color: var(--text-secondary); 
          padding: 6px; 
          border-radius: 50%; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          transition: all 0.2s ease;
        }
        .clear-search:hover { 
          background: rgba(255, 68, 68, 0.2); 
          color: var(--error);
          transform: scale(1.1);
        }

        @media (max-width: 1024px) {
          .admin-sidebar { width: 80px; padding: 20px 10px; }
          .admin-sidebar h2 { display: none; }
          .admin-sidebar nav button span { display: none; }
          .admin-sidebar nav button { justify-content: center; padding: 12px; }
          .admin-main { padding: 20px; }
        }

        @media (max-width: 768px) {
          .admin-dashboard { flex-direction: column; }
          .admin-sidebar { width: 100%; height: auto; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 10px; }
          .admin-sidebar nav { flex-direction: row; justify-content: space-around; }
          .admin-header { flex-direction: column; gap: 15px; text-align: center; }
          .violation-item { flex-direction: column; text-align: center; gap: 20px; }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
