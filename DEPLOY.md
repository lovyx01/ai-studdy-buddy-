# 🚀 Deploying AI Study Buddy to a permanent live site

This app is **full-stack** (Node/Express + SQLite + server-side AI key), so it needs a host that runs a real server — it is **not** a static site you can drop on a CDN.

**Recommended path (this build): Render — Free plan, $0 upfront.**

| Host | Best for | Persistence | Cost to start |
|---|---|---|---|
| **Render (free)** ✅ | Full-stack Node + SQLite, zero cost | ⚠️ DB resets on redeploy (see note below) | **$0** |
| **Railway** | Full-stack with persistent disk | Persistent disk for SQLite | ~$5/mo after trial |
| **Vercel** | Serverless frontends | ❌ SQLite ephemeral — needs a managed DB | Free tier |

---

## Option A — Render (free, $0 upfront) ⭐ recommended

A Blueprint is already provided: **`render.yaml`** at the repo root.

### 1. Push your code to GitHub
```bash
cd ai-study-buddy
git init
git add -A
git commit -m "AI Study Buddy MVP"
git remote add origin https://github.com/YOUR_USERNAME/ai-study-buddy.git
git push -u origin main
```
> `.env`, `server/data/`, `server/uploads/`, `node_modules/` are gitignored — no secrets or databases go into the repo.

### 2. Create the service from the Blueprint
1. Go to **render.com** → **New +** → **Blueprint** → connect your GitHub repo.
2. Render reads `render.yaml`, creates the **ai-study-buddy** service on the **Free** plan (no card required, $0/month).
3. It auto-deploys. When done, open **Dashboard → your service → URL**.

### 3. Set your OpenAI key (⚠️ the important step)
The Blueprint sets everything **except** the API key, which Render intentionally leaves blank for you to fill:
1. In your service → **Environment** → find **`OPENAI_API_KEY`**.
2. Paste your OpenAI key (the one you saved as `STUDORA_OPENAI_KEY`).
3. **Save** — Render masks it; it never appears in logs or the repo.

`OPENAI_MODEL` defaults to `gpt-4o-mini`. Swap to another model in Environment if you like.

### 4. Done
Your live URL is `https://ai-study-buddy.onrender.com` (you can set a custom name). Open it, sign up, and the AI tutor answers with your real key.

### ⚠️ Render Free caveat — database persistence
Render's **free** web services have an **ephemeral filesystem**: the SQLite database in `server/data/` resets whenever the service is **redeployed or restarted** (accounts, subjects, notes, scores are lost). This is fine for a demo / first test. When you're ready for real persistence, either:
- upgrade to a paid plan and add a **Persistent Disk** mounted at `/data` (and set `DB_PATH=/data/studybuddy.db`), or
- move to a managed Postgres (see Vercel section).

---

## Option B — Railway

> Prefer Railway? The steps below still apply.

Railway runs a real Node server with a **persistent volume**, so SQLite just works.

### 1. Push your code to GitHub
```bash
cd ai-study-buddy
git init
git add -A
git commit -m "AI Study Buddy MVP"
git remote add origin https://github.com/YOUR_USERNAME/ai-study-buddy.git
git push -u origin main
```
(If `server/data/` shows up in git, delete it — it's in `.gitignore` anyway.)

### 2. Create the service
1. Go to **railway.app** → **New Project** → **Deploy from GitHub repo** → pick `ai-study-buddy`.
2. Railway detects the server: **Root Directory = `server`**.
3. **Start Command:** `npm start`

### 3. Add a persistent volume (so the SQLite database survives restarts)
1. In the service → **Volumes** → **New Volume**.
2. Mount path: `/app/server/data`  ← the DB lives here (`server/data/studybuddy.db`).

### 4. Add the environment variables (⚠️ the important part)
Service → **Variables** → Add:

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | `sk-...` your real OpenAI key |
| `JWT_SECRET` | a long random string — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | `8080` (Railway provides a port; keep it matching) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` *(or your provider's)* |
| `OPENAI_MODEL` | `gpt-4o-mini` *(or your model)* |

Do **not** copy the `.env` file — set these in Railway's dashboard.

### 5. Deploy
Railway auto-deploys on push. When it's running, click **Settings → Networking → Generate Domain** to get your public `https://ai-study-buddy-production.up.railway.app`.

✅ Done. Open the URL, sign up, and the AI tutor works with your real key.

---

## Option C — Vercel

Vercel is serverless — **SQLite does not persist** across invocations. So to use Vercel you must also add a managed database.

### 1. Add a managed Postgres
- Create a free Postgres on **Neon** or **Supabase**, copy the connection string.

### 2. Switch the data layer to Postgres
The current code uses `better-sqlite3`. To deploy on Vercel, swap the storage driver to a Postgres-compatible one (e.g. `pg` / Drizzle). Update `server/db.js` to read `DATABASE_URL` and run the same schema on Postgres. *(This is a small change; the schema is already defined in `db.js`.)*

### 3. Deploy
- Repo root is `server`, framework preset **Other**, start command `npm start`, build `npm install`.
- **Environment Variables:** same table as Railway above, **plus** `DATABASE_URL=postgres://...`.
- Serverless functions may need `maxDuration` raised (open the AI + upload endpoints) so long AI calls don't time out.

> **Tip:** If you don't want the Postgres work, use **Railway (Option A)** or a **Render/VPS** instead — SQLite just works there and is perfect for an MVP.

---

## Option D — Cheap VPS / manual server (alternative)

Identical to Railway, no volume needed (Render free instances keep their disk between deploys for a while; a VPS keeps it permanently):

```bash
# On the server (VPS) or via Render's dashboard:
cd ai-study-buddy/server
cp .env.example .env   # fill in OPENAI_API_KEY + JWT_SECRET
npm install
npm start              # or run under PM2 for auto-restart
```

---

## After deploying — quick checklist

- [ ] Sign up a new account → lands on Home
- [ ] Ask the AI tutor a question → real answer (not "not connected")
- [ ] Paste notes → generate a Summary and Flashcards
- [ ] Generate + take a quiz → score page works
- [ ] Restart the service → your data is still there (persistence works)

---

## Production notes (before showing real students)

- Set a **strong `JWT_SECRET`** and keep it in the host's env vars.
- Point `OPENAI_MODEL` at a paid, reliable model; add usage limits to control cost.
- **Payments:** connect Stripe (see README → Monetization). Until then the Pro screen is UI-only.
- **Email (forgot password):** wire an SMTP provider; the current demo returns a reset token in the response.
- Uploads go to a local folder — for scale, move them to S3-compatible storage.
