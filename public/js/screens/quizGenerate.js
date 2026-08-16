import { api, friendlyError } from '../api.js';
import { toast, esc, timeAgo } from '../ui.js';

export default async function render(container, params, app) {
  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2>Generate Quiz</h2></div>
      <p class="sub">Tell me the topic and difficulty — I'll write the questions.</p>

      <div class="field mt16">
        <label>Subject (optional)</label>
        <select class="input" id="subject"><option value="">No subject</option></select>
      </div>
      <div class="field">
        <label>Topic</label>
        <input class="input" id="topic" placeholder="e.g. Photosynthesis, Newton's laws…" />
      </div>
      <div class="field">
        <label>Difficulty</label>
        <div class="seg" id="diff">
          <button data-d="easy" class="active">Easy</button>
          <button data-d="medium">Medium</button>
          <button data-d="hard">Hard</button>
        </div>
      </div>
      <div class="field">
        <label>Number of questions</label>
        <div class="chips" id="count">
          ${[3,5,6,10].map((n) => `<button class="chip${n === 6 ? ' active' : ''}" data-n="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary mt8" id="gen">Generate Quiz ✨</button>

      <h3 class="mt24" style="margin-bottom:10px;">Your quizzes</h3>
      <div class="loading-block"><div class="spinner"></div><p>Loading…</p></div>
    </div>`;

  container.querySelector('#back').onclick = () => app.navigate('subjects');

  let diff = 'easy', count = 6;
  container.querySelectorAll('#diff button').forEach((b) => b.onclick = () => { diff = b.dataset.d; container.querySelectorAll('#diff button').forEach((x) => x.classList.remove('active')); b.classList.add('active'); });
  container.querySelectorAll('#count .chip').forEach((b) => b.onclick = () => { count = +b.dataset.n; container.querySelectorAll('#count .chip').forEach((x) => x.classList.remove('active')); b.classList.add('active'); });

  // Load subjects into dropdown + existing quizzes.
  try {
    const [subs, quizes] = await Promise.all([api('/subjects'), api('/quizzes')]);
    const sel = container.querySelector('#subject');
    subs.subjects.forEach((s) => {
      const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.icon} ${s.name}`;
      if (params.subject_id && String(s.id) === String(params.subject_id)) o.selected = true;
      sel.appendChild(o);
    });
    if (params.subject_id) sel.value = params.subject_id;

    const listWrap = container.querySelector('.loading-block');
    listWrap.remove();
    const list = document.createElement('div');
    if (quizes.quizzes.length === 0) {
      list.innerHTML = `<div class="empty"><div class="empty-emoji">🎯</div><div class="empty-title">No quizzes yet</div><p class="empty-sub">Generate your first quiz above.</p></div>`;
    } else {
      quizes.quizzes.forEach((q) => {
        const row = document.createElement('div'); row.className = 'card-row';
        row.innerHTML = `<div class="icon-tile" style="background:var(--info-soft)">❓</div><div class="grow"><div class="card-title">${esc(q.title)}</div><div class="card-sub">${esc(q.difficulty)} • ${timeAgo(q.created_at)}</div></div><span style="color:var(--muted)">›</span>`;
        row.onclick = () => app.navigate('quizTake', { id: q.id });
        list.appendChild(row);
      });
    }
    container.appendChild(list);
  } catch (e) {
    container.querySelector('.loading-block').innerHTML = `<p class="sub">Could not load quizzes.</p>`;
  }

  container.querySelector('#gen').onclick = async () => {
    const topic = container.querySelector('#topic').value.trim();
    const subject_id = container.querySelector('#subject').value || null;
    if (!topic) { toast('Please enter a topic first.', 'error'); return; }
    const btn = container.querySelector('#gen');
    btn.disabled = true; btn.textContent = 'Creating your quiz…';
    try {
      const r = await api('/quizzes/generate', { method: 'POST', body: { subject_id, topic, difficulty: diff, count } });
      toast('Quiz ready! 🎉', 'success');
      app.navigate('quizTake', { id: r.quiz.id });
    } catch (e) {
      toast(friendlyError(e), 'error');
      if (e.status === 429) toast(e.message, 'info');
      btn.disabled = false; btn.textContent = 'Generate Quiz ✨';
    }
  };
}
