import React, { useState } from 'react';
import { apiFetch } from '../util/api';
import { useHospitalProfile } from '../context/HospitalProfileContext';

export default function Login({ onLogin }) {
  const { hospitalName, hospitalLogo, hospitalSubtitle } = useHospitalProfile();

  // Pure domain/route-based determination (Zero manual switcher)
  const isSuperAdmin = (() => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();

    return (
      host.startsWith('admin.') ||
      host.startsWith('control.') ||
      host.startsWith('superadmin.') ||
      path.startsWith('/super-admin') ||
      hash === '#super-admin'
    );
  })();

  const [username, setUsername] = useState(isSuperAdmin ? 'admin@mspkapps.in' : '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError(`Please enter both ${isSuperAdmin ? 'email' : 'username'} and password.`);
      return;
    }

    setIsLoading(true);

    try {
      if (isSuperAdmin) {
        // Control Plane Super Admin Authentication
        const data = await apiFetch('/control-plane/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: username.trim(), password }),
        });

        const { token, admin } = data;
        const adminUser = { ...admin, role: 'SUPER_ADMIN', isControlPlane: true };
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(adminUser));

        if (onLogin) {
          onLogin(adminUser);
        }
      } else {
        // Regular Tenant Hospital Staff Authentication
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), password }),
        });

        const { token, user } = data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        if (onLogin) {
          onLogin(user);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] dark:bg-slate-950 flex flex-col justify-center items-center px-4 font-sans text-gray-800 dark:text-slate-100 antialiased">
      {/* Header section with Logo and Title */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md mb-3 border p-2 overflow-hidden transition-all ${
          isSuperAdmin 
            ? 'bg-slate-900 border-indigo-500/40 shadow-indigo-500/20' 
            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
        }`}>
          {isSuperAdmin ? (
            <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow">
              <span className="text-white font-black text-sm tracking-wider">CP</span>
            </div>
          ) : hospitalLogo ? (
            <img src={hospitalLogo} alt={hospitalName} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-[#181d27] rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-sm tracking-wider">NH</span>
            </div>
          )}
        </div>

        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-1">
          {isSuperAdmin ? 'Platform Control Plane' : hospitalName || 'Neha Hospital'}
        </h1>
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 max-w-xs">
          {isSuperAdmin ? 'Multi-Tenant Cloud & Hardware Gateway Console' : hospitalSubtitle || 'Hospital Management System'}
        </p>
      </div>

      {/* Main Sign In Card */}
      <div className="w-full max-w-[400px] bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-xl p-7 sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
            {isSuperAdmin ? 'Super Administrator Access' : 'Sign In'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {isSuperAdmin 
              ? 'Enter platform master credentials to manage tenants and gateways' 
              : 'Enter your credentials to access the hospital HRMS'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username / Email Field */}
          <div>
            <label 
              htmlFor="username" 
              className="block text-[11px] font-bold tracking-wider text-gray-500 dark:text-slate-400 uppercase mb-2"
            >
              {isSuperAdmin ? 'SUPER ADMIN EMAIL' : 'USERNAME'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <input
                id="username"
                type={isSuperAdmin ? 'email' : 'text'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isSuperAdmin ? 'admin@mspkapps.in' : 'Enter username'}
                className="w-full pl-10 pr-3.5 py-2.5 bg-white dark:bg-slate-950 text-xs text-gray-900 dark:text-white border border-gray-200 dark:border-slate-800 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors"
                autoComplete={isSuperAdmin ? 'email' : 'username'}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-[11px] font-bold tracking-wider text-gray-500 dark:text-slate-400 uppercase mb-2"
            >
              PASSWORD
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white dark:bg-slate-950 text-xs text-gray-900 dark:text-white border border-gray-200 dark:border-slate-800 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors"
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full mt-2 text-white font-medium text-xs py-3 px-4 rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer ${
              isSuperAdmin
                ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 focus:ring-indigo-500 shadow-indigo-600/20'
                : 'bg-[#1e40af] hover:bg-[#1c399b] active:bg-[#193288] focus:ring-blue-500 shadow-blue-600/20'
            }`}
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              isSuperAdmin ? 'Sign In as Super Admin' : 'Sign In'
            )}
          </button>
        </form>
      </div>

      {/* Footer copyright notice */}
      <footer className="mt-8 text-center text-[11px] text-gray-400 dark:text-slate-500 font-normal">
        © 2026 {isSuperAdmin ? 'Platform Control Plane' : hospitalName || 'Neha Hospital'}. All rights reserved.
      </footer>
    </div>
  );
}
