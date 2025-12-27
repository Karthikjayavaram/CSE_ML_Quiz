import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { Trophy, Home, LogOut } from 'lucide-react';

const Completion = () => {
  const { student, logout } = useQuiz();
  const navigate = useNavigate();

  const handleFinish = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="completion-container fade-in">
      <div className="grid-bg"></div>
      <div className="card glass completion-card">
        <Trophy size={80} className="icon-trophy" />
        <h1 className="neon-text">QUIZ COMPLETED!</h1>
        <p className="congrats-text">Congratulations, <strong>{student?.name}</strong>!</p>
        <p className="info-text">Your responses have been successfully submitted to the server.</p>
        
        <div className="result-notice glass">
          <p>Results will be announced by the coordinators after evaluating all participants.</p>
          <p className="note">Tie-breaking logic: Score &gt; Completion Time.</p>
        </div>

        <button className="btn-primary" onClick={handleFinish}>
          <LogOut size={18} /> BACK TO HOME
        </button>
      </div>

      <style jsx="true">{`
        .completion-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        .completion-card {
          text-align: center;
          max-width: 500px;
          padding: 50px;
        }
        .icon-trophy {
          color: var(--primary);
          margin-bottom: 30px;
          filter: drop-shadow(0 0 15px var(--primary-glow));
        }
        .congrats-text {
          font-size: 1.5rem;
          margin: 10px 0;
        }
        .info-text {
          color: var(--text-secondary);
          margin-bottom: 30px;
        }
        .result-notice {
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 40px;
          font-size: 0.9rem;
          background: rgba(0, 242, 255, 0.05);
        }
        .note {
          margin-top: 10px;
          color: var(--primary);
          font-style: italic;
        }
        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default Completion;
