import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { Button } from '../../components/ui/Button';
import { User, Lock } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const { request, loading, error } = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    try {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      login(res.data.user, res.data.token);
      navigate(from, { replace: true });
    } catch (err) { /* Error displayed via `error` state */ }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#eef0f2', fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, background: '#1e2227', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 auto 12px'
          }}>
            NH
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1e2227', margin: 0 }}>Neha Hospital</h1>
          <p style={{ fontSize: 12, color: '#767c83', margin: '4px 0 0' }}>Hospital Management System</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', border: '1px solid #c4c9cf', borderRadius: 8, padding: '28px 28px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2227', marginBottom: 4 }}>Sign In</h2>
          <p style={{ fontSize: 12, color: '#767c83', marginBottom: 20 }}>Enter your credentials to access the system</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#767c83', marginBottom: 4 }}>Username</label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#767c83' }} />
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px 8px 32px',
                    border: '1px solid #c4c9cf', borderRadius: 4, fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', background: '#fff', color: '#1e2227', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#767c83', marginBottom: 4 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#767c83' }} />
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px 8px 32px',
                    border: '1px solid #c4c9cf', borderRadius: 4, fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', background: '#fff', color: '#1e2227', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '8px 12px', fontSize: 12, color: '#dc2626' }}>
                {error}
              </div>
            )}

            <Button type="submit" isLoading={loading} fullWidth size="lg" style={{ marginTop: 4 }}>
              Sign In
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#aeb4bb' }}>
          © {new Date().getFullYear()} Neha Hospital. All rights reserved.
        </p>
      </div>
    </div>
  );
}
