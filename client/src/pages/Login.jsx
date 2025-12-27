import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useQuiz } from '../context/QuizContext';
import { User, Phone, Terminal } from 'lucide-react';
import config from '../config';

const Login = () => {
  const [techziteId, setTechziteId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: setStudentLogin } = useQuiz();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!techziteId || !phone) {
      setError('Please enter both TechZite ID and Phone Number');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${config.API_BASE}/student/login`, { techziteId, phone });
      setStudentLogin(response.data.student);
      navigate('/rules');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container fade-in">
      <div className="grid-bg"></div>
      <div className="card glass login-card">
        <div className="logo-section">
          <Terminal size={48} className="neon-text" />
          <h1 className="neon-text">ML QUIZ 2025</h1>
          <p>Department of CSE - Techzite</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label><User size={18} /> Techzite ID</label>
            <input 
              type="text" 
              placeholder="TZ2025XXX" 
              value={techziteId}
              onChange={(e) => setTechziteId(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="input-group">
            <label><Phone size={18} /> Phone Number</label>
            <input 
              type="password" 
              placeholder="Enter your registered mobile" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'AUTHENTICATING...' : 'START QUIZ'}
          </button>
        </form>

        <div className="admin-link">
          <button onClick={() => navigate('/admin-login')} className="btn-secondary">Admin PortaL</button>
        </div>
      </div>

      <style jsx="true">{`
        .login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        .login-card {
          width: 100%;
          max-width: 450px;
          text-align: center;
        }
        .logo-section {
          margin-bottom: 30px;
        }
        .logo-section h1 {
          font-size: 2.5rem;
          margin: 10px 0;
        }
        .input-group {
          text-align: left;
          margin-bottom: 20px;
        }
        .input-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          color: var(--text-secondary);
        }
        .input-group input {
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: white;
          font-size: 1rem;
        }
        .input-group input:focus {
          border-color: var(--primary);
          outline: none;
          box-shadow: 0 0 10px var(--primary-glow);
        }
        .btn-primary {
          width: 100%;
          margin-top: 10px;
          font-size: 1.1rem;
        }
        .error-msg {
          color: var(--error);
          background: rgba(255, 68, 68, 0.1);
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .admin-link {
          margin-top: 20px;
        }
        .btn-secondary {
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.9rem;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default Login;
