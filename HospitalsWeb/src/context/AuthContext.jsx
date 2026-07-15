import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const AuthContext = createContext(null);

const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem('hospital_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('hospital_token');
      if (token) {
        try {
          const res = await apiRequest('/auth/me');
          setUser(res.data);
        } catch (err) {
          localStorage.removeItem('hospital_token');
        }
      }
      setIsInitializing(false);
    };
    initAuth();
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('hospital_token', token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    localStorage.removeItem('hospital_token');
    setUser(null);
  };

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.role_name === 'Administrator') return true;
    if (user.permissions?.includes('*')) return true;
    return user.permissions?.includes(permission) ?? false;
  }, [user]);

  if (isInitializing) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9ebee' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #525a63', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}></div>
          <p style={{ color: '#767c83', fontSize: 13 }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
