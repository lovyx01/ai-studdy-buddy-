import { api } from '../api.js';
import { minutesLabel, esc, timeAgo } from '../ui.js';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default async function render(container, params, app) {
  container.innerHTML = `
    <div class="screen">
      <div class="page-head"><h2>Progress</h2><p class="sub">Your study analytics at a glance.</p></div>
      <div class="loading-block"><div class="spinner"></div><p>Loading your progress…</p></div>
    </div>`;

  let d;
  try { d = await api('/progress/dashboard'); }
  catch (e) {
    container.querySelector('.loading-block').outerHTML = `<div class="empty"><p class="sub">Could not load progress.</p></div>`;
    return;
  }
  container.querySelector('.loading-block').remove();

  const body = document.createElement('div');

  // Streak highlight card.
  const streakCard = document.createElement('div');
  streakCard.className = 'card';
  streakCard.style.background = 'linear-gradient(135deg,#6C5CE7,#8E44AD)';
  streakCard.style.color = '#fff';
  streakCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div><div style="font-size:14px;opacity:.9;">Study streak</div><div style="font-size:38px;font-weight:800;">${d.streak} 🔥</div><div style="font-size:13px;opacity:.9;">${d.streak === 0 ? 'Study today to start a streak!' : 'Keep it going!'}</div></div>
      <div style="font-size:34px;">🎯</div>
    </div>`;
  body.appendChild(streakCard);

  // Stats grid.
  const stats = document.createElement('div');
  stats.className = 'stat-grid mt16';
  stats.innerHTML = `
    <div class="stat"><div class="stat-num">${minutesLabel(d.todaySeconds)}</div><div class="stat-label">Today's study</div></div>
    <div class="stat"><div class="stat-num">${d.quizzesCompleted}</div><div class="stat-label">Quizzes completed</div></div>
    <div class="stat"><div class="stat-num">${d.avgPercent}%</div><div class="stat-label">Avg quiz score</div></div>
    <div class="stat"><div class="stat-num">${d.flashcardsReviewed}</div><div class="stat-label">Cards reviewed</div></div>`;
  body.appendChild(stats);

  // Weekly bar chart.
  const chartCard = document.createElement('div');
  chartCard.className = 'card mt16';
  const max = Math.max(1, ...d.week.map((w) => w.minutes));
  chartCard.innerHTML = `
    <h3 style="margin-bottom:14px;">This week's study</h3>
    <div class="chart-bars">
      ${d.week.map((w, i) => {
        const h = Math.max(4, Math.round((w.minutes / max) * 100));
        return `<div class="bar ${w.minutes > 0 ? 'fill' : ''}" style="height:${h}%"><span>${w.minutes > 0 ? w.minutes + 'm' : ''}</span></div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:26px;color:var(--muted);font-size:11px;">
      ${d.week.map((w) => `<span>${DAYS[new Date(w.day + 'T12:00:00Z').getDay()]}</span>`).join('')}
    </div>`;
  body.appendChild(chartCard);

  // Recent subjects.
  const subCard = document.createElement('div');
  subCard.className = 'card mt16';
  subCard.innerHTML = `<h3 style="margin-bottom:12px;">Recent subjects</h3>`;
  if (d.recentSubjects.length === 0) {
    subCard.innerHTML += `<p class="sub">No subjects yet. Create one to get started.</p>`;
  } else {
    d.recentSubjects.forEach((s) => {
      subCard.innerHTML += `
        <div class="card-row" style="box-shadow:none;border:1.5px solid var(--border);margin-bottom:8px;">
          <div class="icon-tile" style="background:${s.color}22;">${s.icon}</div>
          <div class="grow"><div class="card-title">${esc(s.name)}</div></div>
          <span style="color:var(--muted)">›</span>
        </div>`;
    });
    subCard.querySelectorAll('.card-row').forEach((r, i) => r.onclick = () => app.navigate('subject', { id: d.recentSubjects[i].id }));
  }
  body.appendChild(subCard);

  container.appendChild(body);

  // Load activity feed.
  try {
    const act = await api('/progress/activity');
    const actCard = document.createElement('div');
    actCard.className = 'card mt16';
    actCard.innerHTML = `<h3 style="margin-bottom:12px;">Recent activity</h3>`;
    if (act.activity.length === 0) actCard.innerHTML += `<p class="sub">Your activity will show up here.</p>`;
    else {
      const icons = { quiz: '❓', flashcards: '🧠', study: '⏱️' };
      act.activity.forEach((a) => {
        actCard.innerHTML += `<div class="kv"><span class="k">${icons[a.kind] || '•'} ${esc(a.title)}</span><span class="muted" style="font-size:12px;">${timeAgo(a.created_at)}</span></div>`;
      });
    }
    container.appendChild(actCard);
  } catch (_) {}
}
