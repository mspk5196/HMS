import React, { useState } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  return (
    <main className="w-full min-h-screen bg-[#f1f4f8]">
      {isLoggedIn ? (
        <AdminDashboard onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <Login onLogin={() => setIsLoggedIn(true)} />
      )}
    </main>
  );
}

export default App;
