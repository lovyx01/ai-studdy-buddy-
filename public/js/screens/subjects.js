import { api, friendlyError } from '../api.js';
import { toast, esc } from '../ui.js';

const SUGGESTED = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science'];

export default async function render(container, params, app) {
  container.innerHTML = `
    <div class="screen">
      <div class="page-head">
        <h2>My Subjects</h2>
        <p class="sub">Organize your materials, quizzes and flashcards by subject.</p>
      </div>
      <div class="loading-block"><div class="spinner"></div><p>Loading subjects…</p></div>
    </div>`;

  let subjects;
  try {
    const d = await api('/subjects');
    subjects = d.subjects;
  } catch (e) {
    container.querySelector('.loading-block').outerHTML =
      `<div class="empty"><div class="empty-emoji">😕</div><p class="sub">Could not load subjects.</p><button class="btn btn-secondary btn-sm mt8" onclick="location.reload()">Retry</button></div>`;
    return;
  }

  const listEl = document.createElement('div');
  if (subjects.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <div class="empty-emoji">📚</div>
        <div class="empty-title">No subjects yet</div>
        <p class="empty-sub">Create your first subject to start studying.</p>
        <button class="btn btn-primary btn-sm" id="create-first">+ Create Subject</button>
      </div>
      <h3 class="mt24" style="margin-bottom:10px;">Popular subjects</h3>
      <div class="chips" id="suggest-chips"></div>`;
    container.appendChild(listEl);
    listEl.querySelector('#create-first').onclick = () => app.navigate('createSubject');
    const chips = listEl.querySelector('#suggest-chips');
    SUGGESTED.forEach((name) => {
      const c = document.createElement('button');
      c.className = 'chip'; c.textContent = name;
      c.onclick = async () => {
        try {
          const r = await api('/subjects', { method: 'POST', body: { name } });
          toast(`Created "${name}"`, 'success');
          app.navigate('subject', { id: r.subject.id });
        } catch (e) { toast(friendlyError(e), 'error'); }
      };
      chips.appendChild(c);
    });
  } else {
    subjects.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `
        <div class="icon-tile" style="background:${s.color}22;">${s.icon}</div>
        <div class="grow">
          <div class="card-title">${esc(s.name)}</div>
          <div class="card-sub">${s.materials} materials • ${s.quizzes} quizzes • ${s.flashcards} flashcard sets</div>
        </div>
        <span style="color:var(--muted)">›</span>`;
      row.onclick = () => app.navigate('subject', { id: s.id });
      listEl.appendChild(row);
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary'; addBtn.textContent = '+ Create Subject';
    addBtn.onclick = () => app.navigate('createSubject');
    listEl.appendChild(addBtn);
  }
  container.appendChild(listEl);
  container.querySelector('.loading-block')?.remove();
}
