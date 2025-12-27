import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { Lock, ShieldAlert } from 'lucide-react';
import config from '../config';
import axios from 'axios'; // Added axios import

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setIsAdmin } = useQuiz();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const credentials = btoa(`${username}:${password}`);
    
    try {
      await axios.get(`${config.API_BASE}/admin/violations`, {
        headers: { Authorization: `Basic ${credentials}` }
      });
      localStorage.setItem('adminAuth', credentials); // Store credentials on successful login
      setIsAdmin(true);
      navigate('/admin/dashboard');
    } catch (error) {
      setError('Invalid admin credentials');
    }
  };

  return (
    <div className="admin-login-container fade-in">
      <div className="grid-bg"></div>
      <div className="card glass login-card">
        <ShieldAlert size={48} className="icon-shield" />
        <h2 className="neon-text">ADMIN ACCESS</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary">ACCESS DASHBOARD</button>
        </form>
      </div>

      <style jsx="true">{`
        .admin-login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .login-card { width: 400px; text-align: center; border: 1px solid var(--secondary); }
        .icon-shield { color: var(--secondary); margin-bottom: 20px; }
        .input-group { text-align: left; margin-bottom: 20px; }
        .input-group label { display: block; margin-bottom: 8px; color: var(--text-secondary); }
        .input-group input { 
          width: 100%; 
          padding: 12px; 
          background: rgba(255, 255, 255, 0.05); 
          border: 1px solid rgba(255, 255, 255, 0.1); 
          border-radius: 8px; 
          color: white; 
        }
        .btn-primary { width: 100%; margin-top: 10px; background: var(--secondary); }
        .error-msg { color: var(--error); margin-top: 10px; }
      `}</style>
    </div>
  );
};

export default AdminLogin;
