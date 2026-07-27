const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Call the API and unwrap the standard { success, message, data, meta } envelope.
 *
 * Returns `result.data` by default. Pass `withMeta: true` to get
 * `{ data, meta }` instead — needed for paginated endpoints, whose
 * meta block carries { total, page, limit, pages }.
 */
export async function apiFetch(endpoint, options = {}) {
  const { withMeta = false, ...fetchOptions } = options;
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
    throw new Error(result?.message || `HTTP error! status: ${response.status}`);
  }

  return withMeta ? { data: result.data, meta: result.meta ?? null } : result.data;
}
