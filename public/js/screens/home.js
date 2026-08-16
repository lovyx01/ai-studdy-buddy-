import { api, getUser } from '../api.js';
import { minutesLabel } from '../ui.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function render(container, params, app) {
  const user = getUser();
  const first = (user?.name || '').split(' ')[0] || 'Student';

  container.innerHTML = `
    <div class="screen">
      <div class="page-head">
        <h1><span class="hello">${greeting()}!</span> 👋</h1>
        <p class="sub">What are you studying today, ${first}?</p>
      </div>

      <div class="home-grid">
        <button class="feature-btn" data-go="chat"><span class="f-icon">🤖</span><span class="f-title">Ask AI</span><span class="f-sub">Tutor & explain</span></button>
        <button class="feature-btn" data-go="scan"><span class="f-icon">📸</span><span class="f-title">Scan Notes</span><span class="f-sub">Photo → study</span></button>
        <button class="feature-btn" data-go="subjects"><span class="f-icon">📚</span><span class="f-title">My Subjects</span><span class="f-sub">Organize work</span></button>
        <button class="feature-btn" data-go="flashcards"><span class="f-icon">🧠</span><span class="f-title">Flashcards</span><span class="f-sub">Memorize faster</span></button>
        <button class="feature-btn" data-go="quizGenerate"><span class="f-icon">❓</span><span class="f-title">Generate Quiz</span><span class="f-sub">Test yourself</span></button>
        <button class="feature-btn" data-go="scan"><span class="f-icon">📝</span><span class="f-title">Study Notes</span><span class="f-sub">Summary & notes</span></button>
      </div>

      <h3 class="mt24" id="progress-title" style="margin-bottom:10px;">Today's study</h3>
      <div class="loading-block"><div class="spinner"></div><p>Loading your progress…</p></div>
    </div>`;

  container.querySelectorAll('.feature-btn').forEach((b) => {
    b.onclick = () => app.navigate(b.dataset.go);
  });

  // Load today's progress.
  try {
    const d = await api('/progress/dashboard');
    const barPct = Math.min(100, Math.round((d.todaySeconds / 3600) * 100));
    const progEl = container.querySelector('#progress-title');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="kv"><span class="k">⏱️ Study time today</span><b>${minutesLabel(d.todaySeconds)}</b></div>
      <div class="progress-bar mt8"><span style="width:${Math.max(4, barPct)}%"></span></div>
      <div class="stat-grid mt16">
        <div class="stat"><div class="stat-num">${d.quizzesCompleted}</div><div class="stat-label">Quizzes done</div></div>
        <div class="stat"><div class="stat-num">${d.avgPercent}%</div><div class="stat-label">Avg score</div></div>
        <div class="stat"><div class="stat-num">${d.flashcardsReviewed}</div><div class="stat-label">Cards reviewed</div></div>
        <div class="stat"><div class="stat-num">${d.streak}🔥</div><div class="stat-label">Day streak</div></div>
      </div>`;
    progEl.after(card);
    container.querySelector('.loading-block')?.remove();
  } catch (e) {
    const ld = container.querySelector('.loading-block');
    if (ld) ld.innerHTML = `<p class="sub">Could not load progress.</p>`;
  }
}
