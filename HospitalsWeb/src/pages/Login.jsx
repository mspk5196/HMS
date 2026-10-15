import React, { useState, useEffect } from 'react';
import { apiFetch } from '../util/api';
import { useHospitalProfile } from '../context/HospitalProfileContext';

function EyeIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeSlashIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function Login({ onLogin }) {
  const { hospitalName, hospitalLogo, hospitalSubtitle } = useHospitalProfile();

  // Standard credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // First-time password reset state
  const [mustChangePasswordState, setMustChangePasswordState] = useState(null); // { token, user }
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Initialize Google Identity Services (GIS)
  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (googleClientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });

        const btnDiv = document.getElementById('googleNativeBtn');
        if (btnDiv) {
          window.google.accounts.id.renderButton(btnDiv, {
            theme: 'outline',
            size: 'large',
            width: 380,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
          });
        }
      } catch (e) {
        console.warn('[GIS Init] Notice:', e.message);
      }
    }
  }, []);

  const handleGoogleCredentialResponse = async (response) => {
    if (!response?.credential) return;
    setIsGoogleLoading(true);
    setError('');
    try {
      const data = await apiFetch('/auth/google-login', {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential }),
      });
      completeLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Google authentication failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  /**
   * Triggers official Google OAuth2 popup flow
   */
  const handleGoogleOAuthClick = () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      setError('Google OAuth Client ID is not configured. Please set VITE_GOOGLE_CLIENT_ID in HospitalsWeb/.env');
      return;
    }

    if (!window.google?.accounts) {
      setError('Google OAuth service is still initializing. Please check your network and refresh the page.');
      return;
    }

    setIsGoogleLoading(true);
    setError('');

    try {
      // 1. Prefer Google OAuth2 Code / Token Client
      if (window.google.accounts.oauth2?.initCodeClient) {
        const codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          ux_mode: 'popup',
          callback: async (authResponse) => {
            if (authResponse.error) {
              setIsGoogleLoading(false);
              setError(`Google Sign-In failed: ${authResponse.error}`);
              return;
            }
            try {
              const data = await apiFetch('/auth/google-login', {
                method: 'POST',
                body: JSON.stringify({ code: authResponse.code }),
              });
              completeLoginSuccess(data);
            } catch (err) {
              setError(err.message || 'Failed to complete Google authentication.');
            } finally {
              setIsGoogleLoading(false);
            }
          },
        });
        codeClient.requestCode();
      } else if (window.google.accounts.oauth2?.initTokenClient) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setIsGoogleLoading(false);
              setError(`Google Sign-In failed: ${tokenResponse.error}`);
              return;
            }
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const profile = await userInfoRes.json();
              const data = await apiFetch('/auth/google-login', {
                method: 'POST',
                body: JSON.stringify({
                  email: profile.email,
                  googleId: profile.sub,
                  name: profile.name,
                  photoUrl: profile.picture,
                }),
              });
              completeLoginSuccess(data);
            } catch (err) {
              setError(err.message || 'Google SSO verification failed.');
            } finally {
              setIsGoogleLoading(false);
            }
          },
        });
        tokenClient.requestAccessToken();
      } else if (window.google.accounts.id) {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
          }
        });
      }
    } catch (e) {
      setIsGoogleLoading(false);
      setError(`Google OAuth error: ${e.message}`);
    }
  };

  const completeLoginSuccess = (data) => {
    const { token, user, mustChangePassword } = data;

    // Check if user is required to set new password on first login
    if (mustChangePassword || user?.must_change_password) {
      localStorage.setItem('token', token);
      setMustChangePasswordState({ token, user });
      return;
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (onLogin) {
      onLogin(user);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      completeLoginSuccess(data);
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstTimePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const data = await apiFetch('/auth/first-time-change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });

      const { token, user } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setMustChangePasswordState(null);

      if (onLogin) {
        onLogin(user);
      }
    } catch (err) {
      setError(err.message || 'Failed to update permanent password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row bg-white dark:bg-[#070b13] font-sans antialiased text-slate-800 dark:text-slate-100 selection:bg-emerald-500 selection:text-white">
      
      {/* ── Left Full-Height Institutional Branding Column ── */}
      <div className="lg:w-[48%] xl:w-[44%] bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#022c22] p-8 sm:p-12 lg:p-16 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
        
        {/* Subtle decorative background effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Branding Section */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/20 shadow-md flex items-center justify-center shrink-0">
              {hospitalLogo ? (
                <img src={hospitalLogo} alt={hospitalName} className="w-full h-full object-contain filter drop-shadow-xs" />
              ) : (
                <div className="w-full h-full bg-emerald-500 rounded-xl flex items-center justify-center font-heading font-black text-white text-base">
                  NH
                </div>
              )}
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30 uppercase tracking-wider mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                <span>Clinical Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-white leading-tight">
                {hospitalName || 'Neha Hospital'}
              </h1>
            </div>
          </div>

          <p className="text-sm text-emerald-100 font-medium leading-relaxed max-w-md">
            {hospitalSubtitle || 'Integrated Hospital Information & Clinical Management System with unified biometric access and digital audit compliance.'}
          </p>
        </div>

        {/* Middle Feature Highlights */}
        <div className="my-10 space-y-4 relative z-10 max-w-lg">
          <div className="flex items-start gap-3.5 p-3.5 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">Enterprise Role-Based Security</div>
              <div className="text-[11px] text-emerald-200/90 mt-0.5 leading-normal">
                Strict granular permission boundaries isolating pharmacy, patient records, payroll, and doctors.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="w-9 h-9 rounded-xl bg-teal-400/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">Google Single Sign-On (SSO)</div>
              <div className="text-[11px] text-emerald-200/90 mt-0.5 leading-normal">
                Seamless one-click Google OAuth authentication with real-time audit logging.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
            <div className="w-9 h-9 rounded-xl bg-cyan-400/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">Mandatory First-Time Password Policy</div>
              <div className="text-[11px] text-emerald-200/90 mt-0.5 leading-normal">
                Staff issued temporary passwords must configure a private password upon first sign-in.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Accreditation */}
        <div className="relative z-10 pt-4 border-t border-emerald-400/20 flex items-center justify-between text-xs text-emerald-200/90">
          <span>Enterprise Hospital Edition</span>
          <span className="font-semibold tracking-wider uppercase text-[10px] bg-emerald-400/20 px-2 py-0.5 rounded-full">
            NABH Audit Compliant
          </span>
        </div>
      </div>

      {/* ── Right Full-Height Interactive Form Column ── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-24 bg-[#f8fafc] dark:bg-[#070b13]">
        
        {/* CONDITIONAL SCREEN 1: First-Time Password Reset */}
        {mustChangePasswordState ? (
          <div className="w-full max-w-[420px] animate-fade-in space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 mb-3">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>First-Time Sign-In Detected</span>
              </div>
              <h2 className="text-2xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
                Create Permanent Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Welcome, <strong className="text-slate-900 dark:text-white">{mustChangePasswordState.user.employee_name || mustChangePasswordState.user.username}</strong>! For hospital data security, you must set your private password before entering the application.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleFirstTimePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  NEW PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    required
                    autoFocus
                    className="w-full pl-3.5 pr-11 py-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-colors shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    title={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  CONFIRM NEW PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full pl-3.5 pr-11 py-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-colors shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 p-3 bg-slate-100/70 dark:bg-slate-900/50 rounded-xl border border-slate-200/80 dark:border-slate-800 leading-relaxed">
                Password must be a minimum of 6 characters. Once set, use this password along with your username to log in.
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-md shadow-emerald-700/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isChangingPassword ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving Secure Password…</span>
                  </>
                ) : (
                  <span>Save Password &amp; Open Dashboard →</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* CONDITIONAL SCREEN 2: Standard Staff Sign In */
          <div className="w-full max-w-[420px] space-y-6 animate-fade-in">
            
            {/* Form Header */}
            <div>
              <h2 className="text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
                Sign In
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Access your clinical workspace, patient records, and hospital tools
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2.5 animate-shake">
                <svg className="w-4 h-4 shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* ── Official Google OAuth2 Button Section ── */}
            <div>
              {/* Optional container for Google Native GIS Button */}
              <div id="googleNativeBtn" className="flex justify-center mb-2 empty:hidden"></div>

              {/* High-Performance Google OAuth Action Button */}
              <button
                type="button"
                onClick={handleGoogleOAuthClick}
                disabled={isGoogleLoading}
                className="w-full py-3 px-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-75"
              >
                {isGoogleLoading ? (
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Sign in with Google OAuth</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
                <span className="bg-[#f8fafc] dark:bg-[#070b13] px-3 text-slate-400">
                  or sign in with password
                </span>
              </div>
            </div>

            {/* Standard Username & Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1.5"
                >
                  USERNAME
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. pranesh-101"
                    className="w-full pl-10 pr-3.5 py-3 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-colors shadow-2xs"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase mb-1.5"
                >
                  PASSWORD
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-11 py-3 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-colors shadow-2xs"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-md shadow-emerald-700/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing In…</span>
                  </div>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>
            </form>

            {/* Footer Notice */}
            <div className="pt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
              © {new Date().getFullYear()} Neha Hospital. Protected by Clinical Access Control.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
