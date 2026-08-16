import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { chat, isAiConfigured, AiNotConfiguredError } from '../services/ai.js';

const router = Router();
router.use(requireAuth);

function month() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function quizUsage(userId, plan) {
  if (plan === 'pro') return { used: 0, limit: Infinity };
  const c = db.prepare(
    `SELECT (SELECT COUNT(*) FROM quizzes WHERE user_id = ? AND substr(created_at,1,7) = ?) AS count`
  ).get(userId, month());
  return { used: c.count, limit: Number(process.env.FREE_MONTHLY_QUIZZES || 3) };
}

// List quizzes for the user (optionally by subject).
router.get('/', (req, res) => {
  const { subject_id } = req.query;
  const rows = subject_id
    ? db.prepare('SELECT id, subject_id, title, topic, difficulty, created_at FROM quizzes WHERE user_id = ? AND subject_id = ? ORDER BY created_at DESC').all(req.user.id, subject_id)
    : db.prepare('SELECT id, subject_id, title, topic, difficulty, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ quizzes: rows, usage: quizUsage(req.user.id, req.user.plan) });
});

// Generate a quiz via AI.
router.post('/generate', async (req, res) => {
  const { subject_id, topic, difficulty = 'easy', count = 6, material_id } = req.body || {};

  if (!topic && !material_id) {
    return res.status(400).json({ error: 'Please enter a topic (or attach a study material).' });
  }

  // Free plan monthly limit.
  if (req.user.plan !== 'pro') {
    const { used, limit } = quizUsage(req.user.id, req.user.plan);
    if (used >= limit) {
      return res.status(429).json({ error: 'daily_limit', message: `Free plan includes ${limit} generated quizzes per month. Upgrade to Pro for unlimited quizzes.` });
    }
  }

  const n = Math.min(Math.max(Number(count) || 6, 1), 15);
  let context = topic;
  if (material_id) {
    const m = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(material_id, req.user.id);
    if (m?.content) context = `Based strictly on this study material:\n${m.content.slice(0, 16000)}`;
  }

  try {
    const output = await chat(
      [
        { role: 'system', content: 'You are an expert exam-question writer for students. Generate accurate, unambiguous multiple-choice questions with exactly one correct answer and a helpful explanation. Output ONLY valid JSON.' },
        { role: 'user', content: `Topic/subject: ${topic || 'study material'}\nDifficulty: ${difficulty}\nNumber of questions: ${n}\n${context}\n\nReturn JSON: {"title":"short title","questions":[{"question":"...","options":["a","b","c","d"],"answer":0,"explanation":"why the answer is right"}]} where "answer" is the 0-based index of the correct option and there are exactly 4 options.` },
      ],
      { json: true }
    );

    const questions = Array.isArray(output.questions) ? output.questions.slice(0, n) : [];
    if (questions.length === 0) throw new Error('empty quiz');
    const title = (output.title || `${topic || 'Quiz'}`).slice(0, 80);

    const subject = subject_id
      ? db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(subject_id, req.user.id)
      : null;

    const info = db.prepare(
      'INSERT INTO quizzes (user_id, subject_id, title, topic, difficulty, questions) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, subject_id || null, title, String(topic || '').slice(0, 120), difficulty, JSON.stringify(questions));

    const quiz = db.prepare('SELECT id, subject_id, title, topic, difficulty, created_at FROM quizzes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ quiz, questions });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'The AI is not connected yet. Add your OPENAI_API_KEY in server/.env and restart.' });
    }
    res.status(502).json({ error: 'The AI could not generate this quiz. Please try again.' });
  }
});

// Save an existing question set as a quiz (used by material -> MCQs/quiz flow).
router.post('/save', (req, res) => {
  const { title, topic, difficulty = 'easy', subject_id, questions } = req.body || {};
  const list = Array.isArray(questions) ? questions : [];
  const clean = list.filter((q) => q && String(q.question).trim() && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer));
  if (!clean.length) return res.status(400).json({ error: 'No valid questions provided.' });
  if (req.user.plan !== 'pro') {
    const { used, limit } = quizUsage(req.user.id, req.user.plan);
    if (used >= limit) return res.status(429).json({ error: 'daily_limit', message: `Free plan includes ${limit} quizzes per month. Upgrade to Pro for unlimited.` });
  }
  const info = db.prepare('INSERT INTO quizzes (user_id, subject_id, title, topic, difficulty, questions) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, subject_id || null, String(title || 'Quiz').slice(0, 80), String(topic || '').slice(0, 120), difficulty, JSON.stringify(clean));
  const quiz = db.prepare('SELECT id, subject_id, title, topic, difficulty, created_at FROM quizzes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ quiz, questions: clean });
});

// Get a quiz by id (returns questions WITHOUT answers until attempted? We return them to allow review after attempt).
router.get('/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!q) return res.status(404).json({ error: 'Quiz not found.' });
  const attempts = db.prepare('SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY created_at DESC').all(q.id);
  res.json({ quiz: q, questions: JSON.parse(q.questions), attempts });
});

// Submit an attempt. body: { answers: number[] }
router.post('/:id/attempt', (req, res) => {
  const q = db.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!q) return res.status(404).json({ error: 'Quiz not found.' });
  const questions = JSON.parse(q.questions);
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

  let score = 0;
  const results = questions.map((question, i) => {
    const chosen = answers[i];
    const correct = chosen === question.answer;
    if (correct) score++;
    return {
      index: i,
      question: question.question,
      options: question.options,
      chosen,
      correctIndex: question.answer,
      correct,
      explanation: question.explanation,
    };
  });

  db.prepare('INSERT INTO quiz_attempts (quiz_id, user_id, score, total, answers) VALUES (?, ?, ?, ?, ?)')
    .run(q.id, req.user.id, score, questions.length, JSON.stringify(answers));

  res.json({ score, total: questions.length, percent: Math.round((score / questions.length) * 100), results });
});

// Delete a quiz.
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM quizzes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Quiz not found.' });
  res.json({ ok: true });
});

export default router;
