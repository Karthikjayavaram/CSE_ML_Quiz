import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuiz } from '../context/QuizContext';
import { Timer, AlertOctagon, CheckCircle, XCircle } from 'lucide-react';
import config from '../config';

const Quiz = () => {
  const { student, socket } = useQuiz();
  const [quizData, setQuizData] = useState(null);
  const [currentIndex, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');
  const [completed, setCompleted] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(true);
  
  const violationRef = useRef(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const navigate = useNavigate();

  // Redirect if no student
  useEffect(() => {
    if (!student) {
      navigate('/');
    }
  }, [student, navigate]);

  if (!student) return null;

  // Fetch Quiz and initialize violations
  useEffect(() => {
    const initQuiz = async () => {
      try {
        // Initial grace period to allow page to settle and fullscreen to activate
        console.log("[QUIZ DEBUG] Entering initial grace period (5s)");
        setGracePeriod(true);
        
        setTimeout(() => {
          setGracePeriod(false);
          console.log("[QUIZ DEBUG] Initial grace period ended");
        }, 5000);

        const API_BASE = config.API_BASE;
        
        const studentResp = await axios.get(`${API_BASE}/student/status/${student.techziteId}`);
        const latestStudent = studentResp.data;
        
        if (latestStudent.status === 'blocked' || (latestStudent.violationCount && latestStudent.violationCount >= 2)) {
          console.log(`[QUIZ DEBUG] Locking due to previous state: status=${latestStudent.status}, count=${latestStudent.violationCount}`);
          violationRef.current = latestStudent.violationCount || 0;
          setViolationCount(latestStudent.violationCount || 0);
          setIsLocked(true);
          setWarningMsg("LOCKED: Previous violations detected or account blocked. Admin approval required.");
        } else {
          console.log(`[QUIZ DEBUG] Student state OK. Violation sync: ${latestStudent.violationCount}`);
          violationRef.current = latestStudent.violationCount || 0;
          setViolationCount(latestStudent.violationCount || 0);
        }

        const quizResp = await axios.get(`${API_BASE}/quiz/active`);
        setQuizData(quizResp.data);
        setTimeLeft(quizResp.data.durationPerQuestion);
      } catch (err) {
        console.error("Initialization failed", err);
      }
    };
    if (student) initQuiz();
  }, [student]);

  // Timer logic
  useEffect(() => {
    if (timeLeft === null || completed || isLocked) return;

    if (timeLeft === 0) {
      handleNext();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft, completed, isLocked]);

  // Anti-cheating
  useEffect(() => {
    const handleVisibilityChange = () => {
      if ((document.visibilityState === 'hidden' || !document.hasFocus()) && !completed && !isLocked && !gracePeriod) {
        reportViolation('Tab Switch / Window Blur');
      }
    };

    const handleFullScreenChange = () => {
      if (!document.fullscreenElement && !completed && !isLocked && !gracePeriod) {
        reportViolation('Exited Full Screen');
      }
    };

    const handleBlur = () => {
      if (!completed && !isLocked && !gracePeriod) {
        reportViolation('Window Focus Lost');
      }
    };

    const disableContext = (e) => e.preventDefault();
    const disableCopyPaste = (e) => {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'v') && !gracePeriod) {
        e.preventDefault();
        reportViolation('Copy/Paste Attempt');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', disableContext);
    document.addEventListener('keydown', disableCopyPaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', disableContext);
      document.removeEventListener('keydown', disableCopyPaste);
    };
  }, [completed, isLocked, gracePeriod]);

  // Socket for violation resolution
  useEffect(() => {
    if (socket) {
      socket.on('violation-resolved', ({ action }) => {
        if (action === 'approve') {
          // Set grace period to prevent immediate re-locking
          setGracePeriod(true);
          setIsLocked(false);
          setShowWarning(false);
          violationRef.current = 0;
          setViolationCount(0);
          
          // Clear grace period after 3 seconds
          setTimeout(() => {
            setGracePeriod(false);
            // Re-enter full screen after grace period
            try {
              document.documentElement.requestFullscreen();
            } catch(e) {}
          }, 3000);
        } else {
          submitQuiz(answers);
        }
      });
    }
    return () => socket?.off('violation-resolved');
  }, [socket, answers]);

  const reportViolation = (type) => {
    // Only report if quiz is active and we're not in a grace period or already locked
    if (!quizData || isLocked || gracePeriod || completed) return;
    
    console.log(`Violation attempt: ${type}. count: ${violationRef.current + 1}`);
    
    violationRef.current += 1;
    const newCount = violationRef.current;
    setViolationCount(newCount);
    
    socket.emit('report-violation', {
      techziteId: student.techziteId,
      name: student.name,
      type,
      count: newCount
    });

    setIsLocked(true);
    setWarningMsg(`LOCKED: ${type} detected. Admin approval required to continue.`);
  };

  const handleNext = () => {
    const currentQuestion = quizData.questions[currentIndex];
    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    
    const newAnswers = [...answers, {
      questionId: currentQuestion._id,
      selectedOption,
      isCorrect
    }];
    setAnswers(newAnswers);

    if (currentIndex < quizData.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedOption('');
      setTimeLeft(quizData.durationPerQuestion);
    } else {
      setCompleted(true);
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (finalAnswers) => {
    const score = finalAnswers.filter(a => a.isCorrect).length;
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    
    try {
      const API_BASE = config.API_BASE;
      await axios.post(`${API_BASE}/quiz/submit`, {
        techziteId: student.techziteId,
        score,
        duration,
        answers: finalAnswers
      });
      navigate('/completion');
    } catch (err) {
      console.error("Submission failed");
    }
  };

  if (!quizData) return <div className="loading">Initializing ML Environment...</div>;

  const currentQ = quizData.questions[currentIndex];

  return (
    <div className="quiz-container">
      <div className="grid-bg"></div>
      
      {/* Header */}
      <div className="quiz-header glass">
        <div className="status">
          <span className="techzite-id">{student.techziteId}</span>
          <span className="divider">|</span>
          <span className="q-count">QUESTION {currentIndex + 1}/{quizData.questions.length}</span>
        </div>
        <div className={`timer ${timeLeft < 10 ? 'urgent' : ''}`}>
          <Timer size={24} />
          <span>{timeLeft}s</span>
        </div>
      </div>

      {/* Main Quiz Area */}
      <div className="quiz-content">
        <div className="card glass question-card fade-in" key={currentIndex}>
          <h3 className="question-text">{currentQ.question}</h3>
          
          <div className="options-grid">
            {currentQ.options.map((option, idx) => (
              <button 
                key={idx}
                className={`option-btn ${selectedOption === option ? 'selected' : ''}`}
                onClick={() => setSelectedOption(option)}
              >
                <div className="opt-indicator">{String.fromCharCode(65 + idx)}</div>
                <span>{option}</span>
              </button>
            ))}
          </div>

          <div className="action-row">
            <button 
              className="btn-primary" 
              onClick={handleNext}
              disabled={!selectedOption && timeLeft > 0}
            >
              {currentIndex === quizData.questions.length - 1 ? 'FINISH QUIZ' : 'NEXT QUESTION'}
            </button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="progress-bar-container">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentIndex + 1) / quizData.questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Violation Overlay */}
      {(showWarning || isLocked) && (
        <div className="violation-overlay glass">
          <div className="card warning-card fade-in">
            <AlertOctagon size={64} className="icon-alert" />
            <h2>SECURITY ALERT</h2>
            <p className="warning-msg">{warningMsg}</p>
            {!isLocked ? (
              <button className="btn-primary" onClick={() => setShowWarning(false)}>ACKNOWLEDGE & CONTINUE</button>
            ) : (
              <p className="status-waiting">Waiting for Admin authorization...</p>
            )}
          </div>
        </div>
      )}

      <style jsx="true">{`
        .quiz-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 20px;
        }
        .quiz-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 30px;
          border-radius: 12px;
          margin-bottom: 30px;
        }
        .techzite-id {
          color: var(--primary);
          font-weight: 700;
        }
        .divider { color: rgba(255, 255, 255, 0.2); margin: 0 15px; }
        .timer {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
        }
        .timer.urgent {
          color: var(--error);
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .quiz-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          max-width: 900px;
          width: 100%;
          margin: 0 auto;
        }
        .question-card {
          width: 100%;
          padding: 40px;
          margin-bottom: 20px;
        }
        .question-text {
          font-size: 1.4rem;
          margin-bottom: 30px;
          line-height: 1.4;
        }
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 40px;
        }
        .option-btn {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          text-align: left;
          color: var(--text-secondary);
          font-size: 1rem;
        }
        .option-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--primary);
        }
        .option-btn.selected {
          background: rgba(0, 242, 255, 0.1);
          border-color: var(--primary);
          color: white;
          box-shadow: 0 0 15px var(--primary-glow);
        }
        .opt-indicator {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .selected .opt-indicator {
          background: var(--primary);
          color: var(--bg-dark);
        }
        .action-row {
          display: flex;
          justify-content: flex-end;
        }
        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(to right, var(--primary), var(--secondary));
          transition: width 0.5s ease-in-out;
        }
        .violation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.9);
        }
        .warning-card {
          text-align: center;
          max-width: 500px;
          padding: 40px;
          border: 2px solid var(--error);
          box-shadow: 0 0 50px rgba(255, 68, 68, 0.3);
        }
        .icon-alert { color: var(--error); margin-bottom: 20px; }
        .warning-msg { font-size: 1.2rem; margin: 20px 0; }
        .status-waiting { color: var(--warning); font-style: italic; margin-top: 20px; }
        .loading { display: flex; height: 100vh; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--primary); }

        @media (max-width: 768px) {
          .options-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default Quiz;
