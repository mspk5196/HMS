import { useState, useCallback } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Unified API hook for all HTTP calls.
 * - Injects JWT Bearer token from localStorage automatically
 * - Returns { request, loading, error }
 * - request(path, options) — path is relative (e.g. '/auth/login')
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('hospital_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${BASE_URL}${path}`;
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
}
