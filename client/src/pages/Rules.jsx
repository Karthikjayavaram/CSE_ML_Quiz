import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Info, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import config from '../config';
import { useQuiz } from '../context/QuizContext'; // Assuming this path for useQuiz

const Rules = () => {
  const [agreed, setAgreed] = useState(false);
  const [quizDetails, setQuizDetails] = useState(null);
  const { student } = useQuiz();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuizDetails = async () => {
      try {
        const response = await axios.get(`${config.API_BASE}/quiz/active`);
        setQuizDetails(response.data);
      } catch (error) {
        console.error("Failed to fetch quiz details:", error);
        // Optionally, handle error display to the user
      }
    };

    fetchQuizDetails();
  }, []); // Empty dependency array means this runs once on mount

  const handleStart = () => {
    if (!agreed) return;
    
    // Attempt full screen
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => {
        alert("Full screen is mandatory for the quiz!");
      });
    }

    navigate('/quiz');
  };

  return (
    <div className="rules-container fade-in">
      <div className="grid-bg"></div>
      <div className="card glass rules-card">
        <h2 className="neon-text"><ShieldCheck /> RULES & CONDITIONS</h2>
        <div className="rules-list">
          <div className="rule-item">
            <Info size={20} className="icon-blue" />
            <p><strong>Time Limit:</strong> Each question has 45 seconds. The timer will <strong>AUTO-SUBMIT</strong> your answer once time runs out.</p>
          </div>
          <div className="rule-item">
            <AlertTriangle size={20} className="icon-red" />
            <p><strong>Strict Policy:</strong> <strong>DO NOT SWITCH TABS</strong> or minimize the window. Any such action will immediately LOCK your quiz.</p>
          </div>
          <div className="rule-item">
            <AlertTriangle size={20} className="icon-yellow" />
            <p><strong>Navigation:</strong> No backward navigation is allowed. Once submitted, you cannot revisit previous questions.</p>
          </div>
          <div className="rule-item">
            <Info size={20} className="icon-blue" />
            <p><strong>Violations:</strong> 2nd violation will LOCK your screen. Admin approval will be required to resume.</p>
          </div>
          <div className="rule-item">
            <Info size={20} className="icon-blue" />
            <p><strong>Tie-Breaking:</strong> If scores are equal, the student with the shorter completion time wins.</p>
          </div>
        </div>

        <div className="agreement">
          <label>
            <input 
              type="checkbox" 
              checked={agreed} 
              onChange={(e) => setAgreed(e.target.checked)} 
            />
            <span>I agree to all the rules and understand the consequences of violations.</span>
          </label>
        </div>

        <button 
          className="btn-primary" 
          disabled={!agreed}
          onClick={handleStart}
        >
          ENTER FULL SCREEN & START QUIZ
        </button>
      </div>

      <style jsx="true">{`
        .rules-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        .rules-card {
          max-width: 600px;
          width: 100%;
        }
        .rules-card h2 {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .rule-item {
          display: flex;
          gap: 15px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          transition: var(--transition-smooth);
        }
        .rule-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .rule-item p {
          font-size: 0.95rem;
          color: var(--text-secondary);
        }
        .rule-item strong {
          color: white;
        }
        .icon-blue { color: var(--primary); }
        .icon-yellow { color: var(--warning); }
        .icon-red { color: var(--error); }
        
        .agreement {
          margin: 30px 0;
          padding: 15px;
          border: 1px solid rgba(0, 242, 255, 0.2);
          border-radius: 8px;
        }
        .agreement label {
          display: flex;
          gap: 12px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .agreement input {
          width: 18px;
          height: 18px;
          accent-color: var(--primary);
        }
        .btn-primary {
          width: 100%;
          padding: 15px;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }
      `}</style>
    </div>
  );
};

export default Rules;
