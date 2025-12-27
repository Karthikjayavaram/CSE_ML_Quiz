import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QuizProvider, useQuiz } from './context/QuizContext';
import Login from './pages/Login';
import Rules from './pages/Rules';
import Quiz from './pages/Quiz';
import Completion from './pages/Completion';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

const ProtectedRoute = ({ children, type }) => {
  const { student, isAdmin } = useQuiz();
  
  if (type === 'student' && !student) return <Navigate to="/" />;
  if (type === 'admin' && !isAdmin) return <Navigate to="/admin-login" />;
  
  return children;
};

function App() {
  return (
    <QuizProvider>
      <Router>
        <Routes>
          {/* Student Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/rules" element={<ProtectedRoute type="student"><Rules /></ProtectedRoute>} />
          <Route path="/quiz" element={<ProtectedRoute type="student"><Quiz /></ProtectedRoute>} />
          <Route path="/completion" element={<ProtectedRoute type="student"><Completion /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute type="admin"><AdminDashboard /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </QuizProvider>
  );
}

export default App;
