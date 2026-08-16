import { api, friendlyError } from '../api.js';
import { toast, esc, timeAgo } from '../ui.js';

export default async function render(container, params, app) {
  const id = params.id;
  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2 id="title">Subject</h2><span id="del" class="icon-btn" title="Delete">🗑️</span></div>
      <div class="loading-block"><div class="spinner"></div><p>Loading…</p></div>
    </div>`;

  container.querySelector('#back').onclick = () => app.navigate('subjects');

  let data;
  try { data = await api(`/subjects/${id}`); }
  catch (e) {
    toast(friendlyError(e), 'error');
    container.querySelector('.loading-block').outerHTML = `<div class="empty"><div class="empty-emoji">😕</div><p class="sub">Subject not found.</p><button class="btn btn-secondary btn-sm mt8" onclick="location.hash='#/subjects'">Back to Subjects</button></div>`;
    return;
  }

  const { subject, materials, quizzes, flashcards } = data;
  container.querySelector('#title').textContent = subject.name;

  container.querySelector('#del').onclick = async () => {
    if (!confirm(`Delete "${subject.name}" and all its content?`)) return;
    try { await api(`/subjects/${subject.id}`, { method: 'DELETE' }); toast('Subject deleted.', 'success'); app.navigate('subjects'); }
    catch (e) { toast(friendlyError(e), 'error'); }
  };

  // Remove loading block; build content.
  container.querySelector('.loading-block').remove();
  const body = document.createElement('div');

  // Quick actions
  const actions = document.createElement('div');
  actions.className = 'grid-2 mt8';
  actions.innerHTML = `
    <button class="gen-btn" data-act="upload"><span class="g-icon">📤</span>Add Material</button>
    <button class="gen-btn" data-act="quiz"><span class="g-icon">❓</span>Generate Quiz</button>
    <button class="gen-btn" data-act="chat"><span class="g-icon">🤖</span>Ask in ${esc(subject.name)}</button>
    <button class="gen-btn" data-act="flash"><span class="g-icon">🧠</span>Flashcards</button>`;
  actions.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'upload') app.navigate('scan', { subject_id: subject.id });
      if (act === 'quiz') app.navigate('quizGenerate', { subject_id: subject.id });
      if (act === 'chat') app.navigate('chat', { subject_id: subject.id });
      if (act === 'flash') app.navigate('flashcards', { subject_id: subject.id });
    };
  });
  body.appendChild(actions);

  // Materials
  const mHead = document.createElement('h3'); mHead.className = 'mt24'; mHead.style.marginBottom = '10px'; mHead.textContent = '📤 Study Materials';
  body.appendChild(mHead);
  if (materials.length === 0) {
    body.appendChild(emptyState('📄', 'No materials yet', 'Upload notes, PDFs or images for this subject.', () => app.navigate('scan', { subject_id: subject.id }), 'Upload Material'));
  } else {
    materials.forEach((m) => {
      const row = document.createElement('div'); row.className = 'card-row';
      const icon = m.kind === 'image' ? '🖼️' : m.kind === 'pdf' ? '📄' : '📝';
      row.innerHTML = `
        <div class="icon-tile">${icon}</div>
        <div class="grow">
          <div class="card-title">${esc(m.title)}</div>
          <div class="card-sub">${m.kind} • ${timeAgo(m.created_at)}</div>
        </div>
        <span style="color:var(--muted)">›</span>`;
      row.onclick = () => app.navigate('scan', { material_id: m.id, subject_id: subject.id });
      body.appendChild(row);
    });
  }

  // Quizzes
  const qHead = document.createElement('h3'); qHead.className = 'mt24'; qHead.style.marginBottom = '10px'; qHead.textContent = '❓ Quizzes';
  body.appendChild(qHead);
  if (quizzes.length === 0) {
    body.appendChild(emptyState('🎯', 'No quizzes yet', 'Create a quiz to test yourself.', () => app.navigate('quizGenerate', { subject_id: subject.id }), 'Generate Quiz'));
  } else {
    quizzes.forEach((q) => {
      const row = document.createElement('div'); row.className = 'card-row';
      row.innerHTML = `
        <div class="icon-tile" style="background:var(--info-soft)">❓</div>
        <div class="grow"><div class="card-title">${esc(q.title)}</div><div class="card-sub">${esc(q.difficulty)} • ${timeAgo(q.created_at)}</div></div>
        <span style="color:var(--muted)">›</span>`;
      row.onclick = () => app.navigate('quizTake', { id: q.id });
      body.appendChild(row);
    });
  }

  // Flashcards
  const fHead = document.createElement('h3'); fHead.className = 'mt24'; fHead.style.marginBottom = '10px'; fHead.textContent = '🧠 Flashcards';
  body.appendChild(fHead);
  if (flashcards.length === 0) {
    body.appendChild(emptyState('🧠', 'No flashcards yet', 'Create flashcards from your material.', () => app.navigate('flashcards', { subject_id: subject.id }), 'View Flashcards'));
  } else {
    flashcards.forEach((f) => {
      const row = document.createElement('div'); row.className = 'card-row';
      row.innerHTML = `
        <div class="icon-tile" style="background:var(--success-soft)">🧠</div>
        <div class="grow"><div class="card-title">${esc(f.title)}</div><div class="card-sub">${timeAgo(f.created_at)}</div></div>
        <span style="color:var(--muted)">›</span>`;
      row.onclick = () => app.navigate('flashcardStudy', { id: f.id });
      body.appendChild(row);
    });
  }

  container.appendChild(body);
}

function emptyState(emoji, title, sub, onclick, btnLabel) {
  const d = document.createElement('div');
  d.className = 'empty'; d.style.padding = '24px 16px';
  d.innerHTML = `<div class="empty-emoji">${emoji}</div><div class="empty-title">${title}</div><p class="empty-sub">${sub}</p><button class="btn btn-primary btn-sm">${btnLabel}</button>`;
  d.querySelector('button').onclick = onclick;
  return d;
}
