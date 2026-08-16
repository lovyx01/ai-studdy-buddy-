import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import subjectRoutes from './routes/subjects.js';
import materialRoutes from './routes/materials.js';
import chatRoutes from './routes/chat.js';
import quizRoutes from './routes/quizzes.js';
import flashcardRoutes from './routes/flashcards.js';
import progressRoutes from './routes/progress.js';
import subscriptionRoutes from './routes/subscription.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health check.
app.get('/api/health', (req, res) => res.json({ ok: true, name: 'AI Study Buddy API' }));

// API routes.
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Serve the built frontend (public/).
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global error handler.
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message === 'INVALID_FILE') {
    return res.status(400).json({ error: 'Invalid file. Please upload a PDF or image (PNG/JPG/WebP).' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is too large. Max size is 8MB.' });
  }
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AI Study Buddy server running`);
  console.log(`   API:   http://localhost:${PORT}/api/health`);
  console.log(`   App:   http://localhost:${PORT}`);
  const key = process.env.OPENAI_API_KEY;
  console.log(`   AI:    ${key ? 'connected ✅' : 'NOT configured ⚠️  (set OPENAI_API_KEY in server/.env)'}`);
});
