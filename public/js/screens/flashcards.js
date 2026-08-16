import { api, friendlyError } from '../api.js';
import { toast, esc, timeAgo } from '../ui.js';

export default async function render(container, params, app) {
  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2>Flashcards</h2></div>
      <p class="sub">Flip through cards and mark what you know.</p>
      <div class="btn-row mt16">
        <button class="btn btn-primary" id="new">+ New Set</button>
        <button class="btn btn-secondary" id="from-material">From Material</button>
      </div>
      <h3 class="mt24" style="margin-bottom:10px;">Your sets</h3>
      <div class="loading-block"><div class="spinner"></div><p>Loading…</p></div>
    </div>`;

  container.querySelector('#back').onclick = () => app.navigate('home');
  container.querySelector('#new').onclick = () => app.navigate('scan');
  container.querySelector('#from-material').onclick = () => { toast('Upload a material and choose "Flashcards" to generate a set.', 'info'); app.navigate('scan'); };

  try {
    const d = await api('/flashcards', { params: { subject_id: params.subject_id } });
    container.querySelector('.loading-block').remove();
    if (d.sets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = `<div class="empty-emoji">🧠</div><div class="empty-title">No flashcard sets yet</div><p class="empty-sub">Upload study material and create flashcards from it, or use the AI tutor.</p>`;
      container.appendChild(empty);
      return;
    }
    d.sets.forEach((s) => {
      const pct = s.cardCount ? Math.round((s.knowCount / s.cardCount) * 100) : 0;
      const row = document.createElement('div'); row.className = 'card-row';
      row.innerHTML = `
        <div class="icon-tile" style="background:var(--success-soft)">🧠</div>
        <div class="grow">
          <div class="card-title">${esc(s.title)}</div>
          <div class="card-sub">${s.cardCount} cards • ${s.knowCount} known</div>
          <div class="progress-bar mt8" style="height:6px;"><span style="width:${pct}%;background:var(--success)"></span></div>
        </div>
        <span style="color:var(--muted)">›</span>`;
      row.onclick = () => app.navigate('flashcardStudy', { id: s.id });
      container.appendChild(row);
    });
  } catch (e) {
    toast(friendlyError(e), 'error');
    container.querySelector('.loading-block').innerHTML = `<p class="sub">Could not load sets.</p>`;
  }
}
