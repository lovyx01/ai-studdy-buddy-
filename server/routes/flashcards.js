import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { chat, isAiConfigured, AiNotConfiguredError } from '../services/ai.js';

const router = Router();
router.use(requireAuth);

function setCount(userId) {
  return db.prepare('SELECT COUNT(*) c FROM flashcard_sets WHERE user_id = ?').get(userId).c;
}

// List flashcard sets (optionally by subject) with review progress.
router.get('/', (req, res) => {
  const { subject_id } = req.query;
  const rows = subject_id
    ? db.prepare('SELECT * FROM flashcard_sets WHERE user_id = ? AND subject_id = ? ORDER BY created_at DESC').all(req.user.id, subject_id)
    : db.prepare('SELECT * FROM flashcard_sets WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);

  const sets = rows.map((s) => {
    const cards = JSON.parse(s.cards);
    const knows = db.prepare('SELECT COUNT(DISTINCT card_index) c FROM flashcard_reviews WHERE user_id = ? AND set_id = ? AND status = ?').get(req.user.id, s.id, 'know').c;
    return { ...s, cards, knowCount: knows, cardCount: cards.length };
  });
  res.json({ sets });
});

// Create a set (manual, cards provided) or generate from a material.
router.post('/', async (req, res) => {
  const { subject_id, title, material_id, cards } = req.body || {};

  // Generate from material via AI.
  if (material_id) {
    if (req.user.plan !== 'pro' && setCount(req.user.id) >= Number(process.env.FREE_FLASHCARD_SETS || 2)) {
      return res.status(403).json({ error: `Free plan includes ${process.env.FREE_FLASHCARD_SETS || 2} flashcard sets. Upgrade to Pro for unlimited.` });
    }
    const m = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(material_id, req.user.id);
    if (!m) return res.status(404).json({ error: 'Material not found.' });
    const source = (m.content || '').slice(0, 16000);
    if (!source) return res.status(400).json({ error: 'No readable text in this material.' });
    try {
      const output = await chat(
        [
          { role: 'system', content: 'You create concise study flashcards from study material. Output ONLY valid JSON.' },
          { role: 'user', content: `Create 10 flashcards. JSON: {"cards":[{"front":"short question or term","back":"clear concise answer"}]}\nMATERIAL:\n${source}` },
        ],
        { json: true }
      );
      const cardList = (Array.isArray(output.cards) ? output.cards : []).slice(0, 30);
      if (!cardList.length) throw new Error('empty');
      const info = db.prepare(
        'INSERT INTO flashcard_sets (user_id, subject_id, title, cards) VALUES (?, ?, ?, ?)'
      ).run(req.user.id, subject_id || null, (title || `${m.title} - Flashcards`).slice(0, 80), JSON.stringify(cardList));
      const set = db.prepare('SELECT * FROM flashcard_sets WHERE id = ?').get(info.lastInsertRowid);
      return res.status(201).json({ set: { ...set, cards: cardList, cardCount: cardList.length, knowCount: 0 } });
    } catch (e) {
      if (e instanceof AiNotConfiguredError) {
        return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'The AI is not connected yet. Add your OPENAI_API_KEY in server/.env and restart.' });
      }
      return res.status(502).json({ error: 'The AI could not create these flashcards. Please try again.' });
    }
  }

  // Manual creation.
  const list = Array.isArray(cards) ? cards.filter((c) => c && String(c.front).trim() && String(c.back).trim()) : [];
  if (!list.length) return res.status(400).json({ error: 'Add at least one card with a front and back.' });
  if (req.user.plan !== 'pro' && setCount(req.user.id) >= Number(process.env.FREE_FLASHCARD_SETS || 2)) {
    return res.status(403).json({ error: `Free plan includes ${process.env.FREE_FLASHCARD_SETS || 2} flashcard sets. Upgrade to Pro for unlimited.` });
  }
  const info = db.prepare(
    'INSERT INTO flashcard_sets (user_id, subject_id, title, cards) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, subject_id || null, (title || 'Flashcards').slice(0, 80), JSON.stringify(list));
  const set = db.prepare('SELECT * FROM flashcard_sets WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ set: { ...set, cards: list, cardCount: list.length, knowCount: 0 } });
});

// Get one set.
router.get('/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM flashcard_sets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Set not found.' });
  const cards = JSON.parse(s.cards);
  const reviews = db.prepare('SELECT card_index, status FROM flashcard_reviews WHERE set_id = ? AND user_id = ?').all(s.id, req.user.id);
  res.json({ set: { ...s, cards, cardCount: cards.length }, reviews });
});

// Record a card review. body: { card_index, status: 'know'|'revision' }
router.post('/:id/review', (req, res) => {
  const s = db.prepare('SELECT * FROM flashcard_sets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Set not found.' });
  const cards = JSON.parse(s.cards);
  const idx = Number(req.body?.card_index);
  const status = req.body?.status === 'know' ? 'know' : 'revision';
  if (!Number.isInteger(idx) || idx < 0 || idx >= cards.length) {
    return res.status(400).json({ error: 'Invalid card index.' });
  }
  db.prepare('INSERT INTO flashcard_reviews (user_id, set_id, card_index, status) VALUES (?, ?, ?, ?)')
    .run(req.user.id, s.id, idx, status);
  const knowCount = db.prepare('SELECT COUNT(DISTINCT card_index) c FROM flashcard_reviews WHERE user_id = ? AND set_id = ? AND status = ?').get(req.user.id, s.id, 'know').c;
  res.json({ knowCount, cardCount: cards.length });
});

// Delete a set.
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM flashcard_sets WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Set not found.' });
  res.json({ ok: true });
});

export default router;
