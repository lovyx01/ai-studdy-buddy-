# 🎓 AI Study Buddy

A complete, runnable **freemium AI tutor app for students** — the MVP you asked for, built from scratch.

Students upload or paste their study material, the AI turns it into **summaries, key points, flashcards, MCQs, quizzes, definitions and revision notes**, and they practice with a chat tutor, interactive quizzes and flip cards — all behind a clean, mobile-first app.

Everything is **real**: real backend, real SQLite storage, real JWT auth, real per-user data isolation, and a real AI integration (OpenAI-compatible). The only thing left for you to do is drop in **one API key**.

---

## What's inside

```
ai-study-buddy/
├── server/                  # Node.js + Express + SQLite backend
│   ├── server.js            # app entry
│   ├── db.js                # schema (users, subjects, materials, chats,
│   │                        #   messages, quizzes, attempts, flashcards,
│   │                        #   reviews, sessions, usage, subscriptions)
│   ├── .env.example         # ← copy to .env and add your AI key
│   ├── middleware/auth.js   # JWT auth (users only ever see their own data)
│   ├── services/ai.js       # OpenAI-compatible AI provider (server-side key)
│   └── routes/              # auth, subjects, materials, chat, quizzes,
│                            #   flashcards, progress, subscription
├── public/                  # Mobile-first web app (no build step)
│   ├── index.html
│   ├── css/styles.css       # design system
│   ├── js/app.js            # router + session + bottom nav
│   ├── js/api.js            # API client + auth token handling
│   └── js/screens/          # 18 screens (onboarding → profile)
└── README.md
```

The frontend is served by the Express server, so there is **no build step** — run one command and it works on a phone.

---

## How to run it (5 minutes)

**Prerequisites:** Node.js 18+ and npm.

```bash
cd server
cp .env.example .env      # then edit .env (see below)
npm install
npm start
```

Open your browser (or phone on the same network) at:

```
http://localhost:8080
```

That's it. The app boots to onboarding → sign up → home.

> To test on a real phone, find your computer's LAN IP (e.g. `192.168.1.20`) and open
> `http://<that-ip>:8080` on the phone. The app also works as a PWA (Add to Home Screen).

---

## ⚠️ The one credential you must add: the AI key

**Everything else works without any setup.** The only thing that needs a real key is the AI tutor itself.

1. Create an API key at **https://platform.openai.com/api-keys**
2. Open `server/.env` and paste it on the line `OPENAI_API_KEY=`
3. Restart the server (`npm start`)

```dotenv
# server/.env
OPENAI_API_KEY=sk-...your-key-here...
```

**The key stays on the server only** — it is never sent to the phone. The backend calls the AI provider for you.

It's **OpenAI-compatible**, so you can use any provider by changing a few lines in `.env` (no code changes):

| Provider | `OPENAI_BASE_URL` | Example `OPENAI_MODEL` |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` (default) | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `anthropic/claude-3.5-sonnet` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Together | `https://api.together.xyz/v1` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` |

Until you add a key, AI features show a clear, friendly "AI not connected" message; the rest of the app (auth, subjects, storing material, manual flashcards, saved quizzes, progress) still works.

---

## Other configuration (all optional, in `server/.env`)

- `PORT` — server port (default `8080`).
- `JWT_SECRET` — set a long random string for auth tokens (a default is provided; change it for production).
- `FREE_DAILY_CHAT`, `FREE_MONTHLY_QUIZZES`, `FREE_MAX_MATERIALS`, `FREE_FLASHCARD_SETS` — free-plan daily/monthly quotas.

---

## Features (all working)

- **Onboarding** (3 screens) → Get Started
- **Auth:** Sign up / Log in / Log out / Forgot password (demo reset link without an email provider). Google sign-in UI is present and ready to connect.
- **Home:** greeting, 6 large action cards, today's progress stats.
- **AI Tutor chat:** explain level (Beginner / Normal / Advanced), example prompts, free-plan daily limit, optional subject/material context.
- **Scan Notes / Study Notes:** upload images, PDFs or paste text → choose **Summary, Key points, Flashcards, MCQs, Quiz, Definitions, Revision notes**.
- **Quiz generator:** subject + topic + difficulty + count → interactive quiz → score circle, per-question review, explanations, retake.
- **Flashcards:** flip, "I know this" / "Need revision", progress tracking, generate sets from material.
- **Subjects:** create/organize; each subject holds its materials, quizzes and flashcards.
- **Progress:** today's time, quizzes done, average score, cards reviewed, streak, weekly chart, recent activity.
- **Profile & Pro:** plan status, usage, upgrade screen.

Every section has **empty states**, **loading states**, and **friendly error messages**. Users only ever access their **own** data (every query is scoped to the logged-in user).

---

## Monetization (freemium — payment NOT faked)

Free vs Pro limits are enforced server-side. The Pro screen and `server/subscription` routes are ready.

Per your requirement, **no fake payments are processed**. The checkout endpoint returns a clear "payment provider not configured" message until you connect a real provider.

**To connect Stripe (when you're ready):**
1. `cd server && npm install stripe`
2. Add to `server/.env`:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PRICE_PRO=price_xxx
   ```
3. In `server/routes/subscription.js`, replace the `POST /checkout` handler with a real Stripe Checkout Session creation, and add a webhook to set the user's `plan = 'pro'` (the `subscriptions` table already has `provider`, `provider_id`, `status` columns for this).

---

## AI and data privacy

- The AI API key lives **only** in `server/.env` and is used exclusively on the server.
- The client never sees the key; the frontend only sends your message text to your own backend.
- Passwords are hashed with bcrypt. Tokens are JWTs.
- All data is stored locally in SQLite (`server/data/studybuddy.db`) and scoped per user.

---

## Known simplifications (MVP trade-offs, ready to extend)

- **Image OCR:** plain-image text extraction isn't built in (would need a vision/OCR step). Paste the text or use the AI tutor to read it — the integration point is in `routes/materials.js`.
- **Email sending:** the "forgot password" flow returns a one-time reset token in the response for demo/testing instead of emailing it. Wire in an SMTP provider for production.
- **Google sign-in:** UI + ready-to-fill backend point in `routes/auth.js`; add a Google OAuth endpoint/token verification to enable.
- **Payments:** Stripe integration point stubbed (see above).

---

## Tech stack

Node.js · Express · better-sqlite3 · JWT (jsonwebtoken) · bcryptjs · multer · vanilla JS (ES modules) mobile-first frontend.

I built and tested it end-to-end: signup/login, subjects, materials, quiz generation & scoring, flashcards, progress stats, subscription gating, password reset, and the AI path against an OpenAI-compatible endpoint.
