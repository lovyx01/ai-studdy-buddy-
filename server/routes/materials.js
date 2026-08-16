import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { chat, pdfToText, isAiConfigured, AiNotConfiguredError } from '../services/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
router.use(requireAuth);

// ------------------------------------------------------------------
// Uploads are stored on the server disk under ../uploads (never DB).
// ------------------------------------------------------------------
const uploadRoot = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const ALLOWED_IMG = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic'];
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.pdf' || ALLOWED_IMG.includes(ext)) return cb(null, true);
    cb(new Error('INVALID_FILE'));
  },
});

function freeMaterialLimitReached(userId) {
  const count = db.prepare('SELECT COUNT(*) c FROM materials WHERE user_id = ?').get(userId).c;
  return count >= Number(process.env.FREE_MAX_MATERIALS || 5);
}

// Upload a file (image/pdf) or paste plain text.
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { subject_id, title, text } = req.body || {};

    // Plain text upload (no file).
    if (!req.file) {
      const content = String(text || '').trim();
      if (!content) return res.status(400).json({ error: 'Please enter some text or upload a file.' });
      if (req.user.plan !== 'pro' && freeMaterialLimitReached(req.user.id)) {
        return res.status(403).json({ error: 'Free plan: you can upload up to 5 materials. Upgrade to Pro for more.' });
      }
      const info = db.prepare(
        'INSERT INTO materials (user_id, subject_id, title, kind, content) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, subject_id || null, (title || 'Notes').slice(0, 120), 'text', content);
      const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid);
      return res.status(201).json({ material: mat });
    }

    // File upload.
    if (req.user.plan !== 'pro' && freeMaterialLimitReached(req.user.id)) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Free plan: you can upload up to 5 materials. Upgrade to Pro for more.' });
    }

    const ext = path.extname(req.file.originalname || '').toLowerCase();
    const kind = ext === '.pdf' ? 'pdf' : 'image';
    const relPath = path.relative(uploadRoot, req.file.path);

    let content = null;
    if (kind === 'pdf') {
      const buf = fs.readFileSync(req.file.path);
      content = pdfToText(buf) || null; // best-effort text extraction
    }

    const info = db.prepare(
      'INSERT INTO materials (user_id, subject_id, title, kind, content, file_path) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, subject_id || null, (title || req.file.originalname || 'Material').slice(0, 120), kind, content, relPath);

    const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ material: mat });
  } catch (e) {
    if (req.file) fs.unlinkSync(req.file.path).catch?.(() => {});
    if (e.message === 'INVALID_FILE') {
      return res.status(400).json({ error: 'Invalid file. Please upload a PDF or an image (PNG/JPG/WebP).' });
    }
    res.status(500).json({ error: 'Failed to upload. Please try again.' });
  }
});

// List materials for the user (optionally filtered by subject).
router.get('/', (req, res) => {
  const { subject_id } = req.query;
  const rows = subject_id
    ? db.prepare('SELECT * FROM materials WHERE user_id = ? AND subject_id = ? ORDER BY created_at DESC').all(req.user.id, subject_id)
    : db.prepare('SELECT * FROM materials WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ materials: rows });
});

// Get one material (serves the full text for analysis).
router.get('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!m) return res.status(404).json({ error: 'Material not found.' });
  res.json({ material: m });
});

// Serve the raw file (only to its owner).
router.get('/:id/file', (req, res) => {
  const m = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!m || !m.file_path) return res.status(404).json({ error: 'File not found.' });
  const abs = path.join(uploadRoot, path.basename(m.file_path));
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File not found.' });
  res.sendFile(abs);
});

// Delete a material.
router.delete('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!m) return res.status(404).json({ error: 'Material not found.' });
  if (m.file_path) {
    const abs = path.join(uploadRoot, path.basename(m.file_path));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
  db.prepare('DELETE FROM materials WHERE id = ?').run(m.id);
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// AI GENERATION from a material:
//   kind: summary | keypoints | flashcards | mcqs | quiz | definitions | revision
// Returns structured study material.
// ------------------------------------------------------------------
const GENERATION_PROMPTS = {
  summary: 'Write a clear, well-structured summary of the material. Use short paragraphs and bullet points. Keep it study-friendly for a school/university student.',
  keypoints: 'Extract the most important key points from the material. Return them as a clean bulleted list, each point one line.',
  flashcards: 'Create 8-12 flashcards from the material to help a student memorize it. Return them as JSON: {"cards":[{"front":"question/term","back":"answer/definition"}]}. Front should be a short question or term, back a concise clear answer.',
  mcqs: 'Create 5 multiple-choice questions from the material. Return them as JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"answer":0,"explanation":"why"}]}. The "answer" field is the 0-based index of the correct option. Include one short explanation per question.',
  quiz: 'Create a short quiz of 6 multiple-choice questions from the material with increasing difficulty. Return JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"answer":0,"explanation":"..."}]}. The "answer" field is the 0-based index of the correct option.',
  definitions: 'List the important definitions/terms from the material. Format each as "**Term** - definition" on its own line. Aim for 8-12 key terms.',
  revision: 'Create comprehensive revision notes from the material: a summary, key formulas/definitions, common mistakes, and a "test yourself" quick list of questions. Use headings and bullet points.',
};

// POST /materials/:id/generate  body: { kind }
router.post('/:id/generate', async (req, res) => {
  const m = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!m) return res.status(404).json({ error: 'Material not found.' });

  const { kind } = req.body || {};
  const prompt = GENERATION_PROMPTS[kind];
  if (!prompt) return res.status(400).json({ error: 'Unknown generation type.' });

  const sourceText = (m.content || '').trim();
  if (!sourceText && m.kind === 'image') {
    return res.status(400).json({
      error: 'We could not read text from this image automatically. Tip: paste the text instead, or ask the AI tutor to read it.',
    });
  }
  if (!sourceText) return res.status(400).json({ error: 'No readable text in this material.' });

  const needsJson = kind === 'flashcards' || kind === 'mcqs' || kind === 'quiz';

  try {
    const system = `You are an expert study assistant for students. Read the material and follow the user instruction exactly. Be accurate, clear and encouraging. Never invent facts not present in the material.`;
    const output = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: `STUDY MATERIAL:\n${sourceText.slice(0, 16000)}\n\nTASK: ${prompt}` },
      ],
      { json: needsJson }
    );
    res.json({ output, kind });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'The AI is not connected yet. Add your OPENAI_API_KEY in server/.env and restart.' });
    }
    res.status(502).json({ error: 'The AI could not complete this request. Please try again.' });
  }
});

export default router;
