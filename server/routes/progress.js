import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// POST /progress/session  body: { kind, seconds }
// Log a study session (called by the client periodically while studying).
router.post('/session', (req, res) => {
  const kind = ['chat', 'quiz', 'flashcards', 'notes'].includes(req.body?.kind) ? req.body.kind : 'notes';
  const seconds = Math.max(0, Math.min(Number(req.body?.seconds) || 0, 3600));
  db.prepare('INSERT INTO study_sessions (user_id, kind, seconds) VALUES (?, ?, ?)').run(req.user.id, kind, seconds);
  res.json({ ok: true });
});

// GET /progress/dashboard - aggregated stats for the Progress tab + Home.
router.get('/dashboard', (req, res) => {
  const uid = req.user.id;

  // Total study seconds today.
  const todayRow = db.prepare(
    `SELECT COALESCE(SUM(seconds),0) sec FROM study_sessions
     WHERE user_id = ? AND date(started_at) = date('now')`
  ).get(uid);
  const todaySeconds = todayRow.sec;

  // Quizzes completed + average score.
  const quizStats = db.prepare(
    `SELECT COUNT(*) attempts, COALESCE(AVG(score*1.0/total),0) avg
     FROM quiz_attempts WHERE user_id = ?`
  ).get(uid);
  const avgPercent = Math.round((quizStats.avg || 0) * 100);

  // Flashcards reviewed (distinct cards ever marked).
  const flReviewed = db.prepare(
    'SELECT COUNT(DISTINCT card_index) c FROM flashcard_reviews WHERE user_id = ?'
  ).get(uid).c;

  // Study streak: consecutive days with a session, ending today (or yesterday).
  const sessionDays = db.prepare(
    `SELECT DISTINCT date(started_at) day FROM study_sessions WHERE user_id = ? ORDER BY day DESC`
  ).all(uid).map((r) => r.day);
  let streak = 0;
  const dayMs = 86400000;
  const cursor = new Date();
  // If today has no sessions, allow streak anchored on yesterday.
  const set = new Set(sessionDays);
  const todayStr = cursor.toISOString().slice(0, 10);
  if (!set.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Recent subjects (by latest activity).
  const recentSubjects = db.prepare(
    `SELECT s.id, s.name, s.color, s.icon,
       MAX(COALESCE(m.created_at, '') || COALESCE(q.created_at, '') || COALESCE(f.created_at, '')) AS last
     FROM subjects s
     LEFT JOIN materials m ON m.subject_id = s.id
     LEFT JOIN quizzes q ON q.subject_id = s.id
     LEFT JOIN flashcard_sets f ON f.subject_id = s.id
     WHERE s.user_id = ?
     GROUP BY s.id
     ORDER BY last DESC LIMIT 4`
  ).all(uid).map((s) => ({ id: s.id, name: s.name, color: s.color, icon: s.icon }));

  // Weekly study time (last 7 days) for a simple bar chart.
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * dayMs);
    const day = d.toISOString().slice(0, 10);
    const row = db.prepare(
      `SELECT COALESCE(SUM(seconds),0) sec FROM study_sessions WHERE user_id = ? AND date(started_at) = ?`
    ).get(uid, day);
    week.push({ day, minutes: Math.round(row.sec / 60) });
  }

  res.json({
    todaySeconds,
    todayMinutes: Math.round(todaySeconds / 60),
    quizzesCompleted: quizStats.attempts,
    avgPercent,
    flashcardsReviewed: flReviewed,
    streak,
    recentSubjects,
    week,
  });
});

// GET /progress/activity - recent activity feed.
router.get('/activity', (req, res) => {
  const uid = req.user.id;
  const quizzes = db.prepare(
    `SELECT 'quiz' kind, title, created_at FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.user_id = ?`
  ).all(uid);
  const flash = db.prepare(
    `SELECT 'flashcards' kind, title, created_at FROM flashcard_sets WHERE user_id = ?`
  ).all(uid);
  const sessions = db.prepare(
    `SELECT 'study' kind, 'Studied for ' || printf('%d min', MAX(1, seconds/60)) || ' • ' || kind AS title, started_at AS created_at
     FROM study_sessions WHERE user_id = ?`
  ).all(uid);
  const feed = [...quizzes, ...flash, ...sessions]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 20)
    .map((r) => ({ ...r, created_at: r.created_at }));
  res.json({ activity: feed });
});

export default router;
