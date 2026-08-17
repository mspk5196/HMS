const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Call the API and unwrap the standard { success, message, data, meta } envelope.
 *
 * Returns `result.data` by default. Pass `withMeta: true` to get
 * `{ data, meta }` instead — needed for paginated endpoints, whose
 * meta block carries { total, page, limit, pages }.
 */
let refreshPromise = null;

/**
 * Permissions are baked into the JWT at login/refresh time. If a role gets
 * edited in Settings, everyone already logged in still carries the old
 * permission list until their token is replaced — so a 403 here doesn't
 * necessarily mean "really forbidden," it might just mean "stale token."
 * Fetch a fresh one (deduped across concurrent 403s) and let the caller
 * retry exactly once before giving up for real.
 */
function refreshToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.data?.token) {
          localStorage.setItem('token', result.data.token);
          localStorage.setItem('user', JSON.stringify(result.data.user));
          return true;
        }
        return false;
      })
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiFetch(endpoint, options = {}) {
  const { withMeta = false, _retried = false, ...fetchOptions } = options;
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  let result;
  try {
    result = await response.json();
  } catch (err) {
    throw new Error('Invalid JSON response from server');
  }

  if (!response.ok || (result && result.success === false)) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-expired'));
    }

    if (response.status === 403 && token && !_retried && endpoint !== '/auth/refresh') {
      const refreshed = await refreshToken();
      if (refreshed) {
        return apiFetch(endpoint, { ...options, _retried: true });
      }
    }

    throw new Error(result?.message || `HTTP error! status: ${response.status}`);
  }

  return withMeta ? { data: result.data, meta: result.meta ?? null } : result.data;
}
