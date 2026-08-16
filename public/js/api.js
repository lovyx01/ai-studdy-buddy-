// ------------------------------------------------------------------
// API client. Talks to the backend. Stores the JWT in localStorage.
// On 401 (expired session) it signs the user out and shows login.
// ------------------------------------------------------------------

const TOKEN_KEY = 'asb_token';
const USER_KEY = 'asb_user';

// Auto-detect the API base. When served by the Express server, use the
// same origin. Override with ASB_API_URL if you host them separately.
export const API = (() => {
  const custom = localStorage.getItem('asb_api');
  if (custom) return custom.replace(/\/$/, '');
  const loc = window.location.origin;
  return loc || 'http://localhost:8080';
})();

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}
export function setUser(u) { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); }

export function isAuthed() { return Boolean(getToken()); }

export async function api(path, { method = 'GET', body, params } = {}) {
  let url = `${API}/api${path}`;
  if (params) {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
    if (q) url += `?${q}`;
  }
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body instanceof FormData) {
    // don't set content-type; browser sets boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  let res;
  try {
    // 25s timeout so a slow/hung request can never block a screen forever.
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(25000) });
  } catch (e) {
    throw new Error('NETWORK');
  }

  let data = {};
  try { data = await res.json(); } catch (_) { /* empty body */ }

  if (res.status === 401 && isAuthed()) {
    // session expired -> log out
    setToken(null); setUser(null);
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error(data.error || 'Session expired');
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.error;
    err.data = data;
    throw err;
  }
  return data;
}

// Error message helper: maps network / backend errors to friendly text.
export function friendlyError(err) {
  if (!err) return 'Something went wrong.';
  if (err.message === 'NETWORK') return 'No internet connection. Please check and try again.';
  if (err.message === 'Session expired') return 'Your session expired. Please log in again.';
  if (err.code === 'AI_NOT_CONFIGURED') return 'The AI is not connected yet. Add your OPENAI_API_KEY in server/.env and restart the server.';
  return err.message || 'Something went wrong. Please try again.';
}
