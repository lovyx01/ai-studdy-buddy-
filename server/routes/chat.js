import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { chat, isAiConfigured, AiNotConfiguredError } from '../services/ai.js';

const router = Router();
router.use(requireAuth);

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Daily chat usage for the user (respects plan).
function chatUsage(userId, plan) {
  if (plan === 'pro') return { used: 0, limit: Infinity };
  const row = db.prepare('SELECT chat_count FROM daily_usage WHERE user_id = ? AND day = ?').get(userId, today());
  return { used: row?.chat_count || 0, limit: Number(process.env.FREE_DAILY_CHAT || 15) };
}

function bumpChat(userId) {
  db.prepare(
    `INSERT INTO daily_usage (user_id, day, chat_count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET chat_count = chat_count + 1`
  ).run(userId, today());
}

const TUTOR_SYSTEM = `You are "Study Buddy", a friendly, encouraging AI tutor for school and university students.
Guidelines:
- Explain concepts simply and clearly; avoid unnecessary jargon.
- Give concrete examples whenever it helps.
- Break big topics into small, numbered steps.
- Occasionally ask the student a quick check-in question, then continue.
- Never make the student feel stupid for asking basic questions. Always be warm and encouraging.
- If the student asks to be quizzed or for practice, provide a short quiz they can answer in chat.
The student's chosen explanation level is provided in each message and should shape how detailed your answer is.`;

// List chats for the user.
router.get('/', (req, res) => {
  const chats = db
    .prepare('SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ chats });
});

// Create a chat.
router.post('/', (req, res) => {
  const { subject_id, title } = req.body || {};
  const info = db
    .prepare('INSERT INTO chats (user_id, subject_id, title) VALUES (?, ?, ?)')
    .run(req.user.id, subject_id || null, (title || 'New chat').slice(0, 80));
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ chat });
});

// Get a chat with its messages.
router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Chat not found.' });
  const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC').all(c.id);
  res.json({ chat: c, messages });
});

// Rename a chat.
router.patch('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Chat not found.' });
  const title = (req.body.title || c.title).toString().slice(0, 80);
  db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(title, c.id);
  res.json({ chat: db.prepare('SELECT * FROM chats WHERE id = ?').get(c.id) });
});

// Delete a chat.
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM chats WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Chat not found.' });
  res.json({ ok: true });
});

// POST /chats/:id/message  body: { content, explain_level, material_id? }
// Records the user message, calls the AI, stores the assistant reply.
router.post('/:id/message', async (req, res) => {
  const c = db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Chat not found.' });

  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Please type a message.' });

  const level = ['beginner', 'normal', 'advanced'].includes(req.body?.explain_level)
    ? req.body.explain_level
    : 'normal';

  // Free plan daily limit.
  if (req.user.plan !== 'pro') {
    const { used, limit } = chatUsage(req.user.id, req.user.plan);
    if (used >= limit) {
      return res.status(429).json({
        error: 'daily_limit',
        message: `You have reached today's free limit of ${limit} AI messages. Upgrade to Pro for unlimited chat, or come back tomorrow!`,
      });
    }
  }

  // Optionally attach a study material for context.
  let materialContext = '';
  if (req.body?.material_id) {
    const m = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(req.body.material_id, req.user.id);
    if (m && m.content) materialContext = `The student uploaded this study material - use it as your main reference:\n${m.content.slice(0, 16000)}`;
  }

  // Record user message.
  db.prepare('INSERT INTO messages (chat_id, role, content, explain_level) VALUES (?, ?, ?, ?)')
    .run(c.id, 'user', content, level);
  bumpChat(req.user.id);

  try {
    // Build a light conversation history (last ~10 messages) + system.
    const history = db
      .prepare('SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 10')
      .all(c.id)
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    const messages = [
      { role: 'system', content: TUTOR_SYSTEM },
      ...(materialContext ? [{ role: 'system', content: materialContext }] : []),
      { role: 'system', content: `Current explanation level requested by the student: ${level}.` },
      ...history,
    ];

    const answer = await chat(messages, { temperature: 0.7 });

    db.prepare('INSERT INTO messages (chat_id, role, content, explain_level) VALUES (?, ?, ?, ?)')
      .run(c.id, 'assistant', answer, level);

    const reply = db.prepare('SELECT * FROM messages WHERE id = last_insert_rowid()').get();
    res.json({ message: reply, usage: chatUsage(req.user.id, req.user.plan) });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'The AI is not connected yet. Add your OPENAI_API_KEY in server/.env and restart.' });
    }
    return res.status(502).json({ error: 'The AI did not respond. Please check your connection and try again.' });
  }
});

export default router;
