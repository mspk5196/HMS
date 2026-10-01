import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import { ThemeProvider } from './context/ThemeContext';
import { HospitalProfileProvider } from './context/HospitalProfileContext';

function AppContent() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('neha_active_tab');
    if (typeof window !== 'undefined' && window.location.hash) {
      window.location.hash = '';
    }
    setUser(null);
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  useEffect(() => {
    const handleAuthExpired = () => {
      handleLogout();
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  return (
    <main className="w-full min-h-screen bg-[#f8fafc] dark:bg-[#0b0e14] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {user ? (
        <AdminDashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </main>
  );
}

function App() {
  return (
    <ThemeProvider>
      <HospitalProfileProvider>
        <AppContent />
      </HospitalProfileProvider>
    </ThemeProvider>
  );
}

export default App;
