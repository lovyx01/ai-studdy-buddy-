import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const COLORS = ['#6C5CE7', '#00B894', '#0984E3', '#E17055', '#00A8CC', '#8E44AD', '#16A085', '#D63031'];
const ICONS = ['📚', '🔬', '🧪', '🧬', '💬', '💻', '🧮', '🌍', '🎨', '📐'];

// List all subjects for the user with summary counts.
router.get('/', (req, res) => {
  const subjects = db
    .prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);

  const attach = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM materials   WHERE subject_id = ?) AS materials,
      (SELECT COUNT(*) FROM quizzes     WHERE subject_id = ?) AS quizzes,
      (SELECT COUNT(*) FROM flashcard_sets WHERE subject_id = ?) AS flashcards
  `);

  const result = subjects.map((s) => {
    const c = attach.get(s.id, s.id, s.id);
    return { ...s, ...c };
  });
  res.json({ subjects: result });
});

// Create a subject.
router.post('/', (req, res) => {
  const { name } = req.body || {};
  const clean = String(name || '').trim();
  if (!clean) return res.status(400).json({ error: 'Subject name is required.' });
  const count = db.prepare('SELECT COUNT(*) c FROM subjects WHERE user_id = ?').get(req.user.id).c;
  const color = COLORS[count % COLORS.length];
  const icon = ICONS[count % ICONS.length];
  const info = db
    .prepare('INSERT INTO subjects (user_id, name, color, icon) VALUES (?, ?, ?, ?)')
    .run(req.user.id, clean, color, icon);
  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ subject });
});

// Get one subject with all its related content.
router.get('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Subject not found.' });
  const materials = db.prepare('SELECT * FROM materials WHERE subject_id = ? ORDER BY created_at DESC').all(s.id);
  const quizzes = db.prepare('SELECT id, title, topic, difficulty, created_at FROM quizzes WHERE subject_id = ? ORDER BY created_at DESC').all(s.id);
  const flashcards = db.prepare('SELECT id, title, created_at FROM flashcard_sets WHERE subject_id = ? ORDER BY created_at DESC').all(s.id);
  res.json({ subject: s, materials, quizzes, flashcards });
});

// Update subject (name/icon/color).
router.patch('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Subject not found.' });
  const name = (req.body.name ?? s.name).toString().trim() || s.name;
  db.prepare('UPDATE subjects SET name = ?, icon = ?, color = ? WHERE id = ?')
    .run(name, req.body.icon ?? s.icon, req.body.color ?? s.color, s.id);
  res.json({ subject: db.prepare('SELECT * FROM subjects WHERE id = ?').get(s.id) });
});

// Delete subject.
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Subject not found.' });
  res.json({ ok: true });
});

export default router;
