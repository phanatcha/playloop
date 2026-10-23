import { api } from './api.js';

// Auth endpoints from docs/api/paths/auth.yaml. The session itself is the httpOnly
// playloop_token cookie, so none of these return or store a token.

// GET /auth/username-available -> { username, available, reason? } (reason: taken | invalid | reserved)
export function checkUsername(username, options) {
  return api.get(`/auth/username-available?username=${encodeURIComponent(username)}`, options);
}

// POST /auth/register -> 201 Me. `acceptTerms` must be the literal `true`.
export function register({ username, email, password }) {
  return api.post('/auth/register', { username, email, password, acceptTerms: true });
}

// POST /auth/login -> 200 Me
export function login({ email, password }) {
  return api.post('/auth/login', { email, password });
}

// POST /auth/logout -> 204
export function logout() {
  return api.post('/auth/logout');
}

// GET /me -> Me, or 401 when logged out. Call it on app start.
export function getMe(options) {
  return api.get('/me', options);
}
