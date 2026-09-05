import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';

function App() {
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
    <main className="w-full min-h-screen bg-[#f1f4f8]">
      {user ? (
        <AdminDashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </main>
  );
}

export default App;
