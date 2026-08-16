import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const router = Router();

// Sign up with email + password.
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const info = db
      .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
      .run(normalized, hash, (name || '').trim() || normalized.split('@')[0]);
    const user = db.prepare('SELECT id, email, name, plan FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong creating your account. Please try again.' });
  }
});

// Log in with email + password.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalized = String(email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    const ok = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });
    const safe = { id: user.id, email: user.email, name: user.name, plan: user.plan };
    res.json({ token: signToken(safe), user: safe });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Forgot password -> issue a reset token (no email infra in MVP).
router.post('/forgot', async (req, res) => {
  const { email } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
  // Always return success-ish to avoid leaking which emails exist.
  if (!user) return res.json({ ok: true, message: 'If an account exists, a reset link has been sent.' });
  res.json({
    ok: true,
    message: 'If an account exists, a reset link has been sent.',
    // MVP placeholder: return a one-time reset token so the flow is demonstrable
    // without an SMTP provider. Replace with emailed links before launch.
    resetToken: signToken({ id: user.id, email: user.email, purpose: 'reset' }),
  });
});

// Reset password using the token returned above (MVP flow).
router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing reset token.' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const payload = jwtVerify(token);
    if (!payload) return res.status(401).json({ error: 'Reset link is invalid or expired.' });
    const hash = await bcrypt.hash(String(password), 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, payload.sub);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

function jwtVerify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Get current user (used on app load to restore session).
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
