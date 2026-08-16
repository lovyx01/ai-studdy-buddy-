import { api, friendlyError } from '../api.js';
import { toast, esc } from '../ui.js';

export default async function render(container, params, app) {
  let set;
  try { set = (await api(`/flashcards/${params.id}`)).set; }
  catch (e) {
    container.innerHTML = `<div class="screen"><div class="empty"><p class="sub">Set not found.</p><button class="btn btn-secondary btn-sm mt8" onclick="location.hash='#/flashcards'">Back</button></div></div>`;
    return;
  }

  const cards = set.cards || [];
  const startedAt = Date.now();
  let idx = 0, flipped = false;
  let reviewed = 0, known = 0, revision = 0;
  let sessionsSaved = false;

  container.innerHTML = `
    <div class="screen" style="padding-top:14px;">
      <div class="toolbar"><span class="back" id="back">←</span><h2 style="font-size:17px;">${esc(set.title)}</h2></div>
      <div class="flash-count" id="count"></div>
      <div class="flash-card" id="card">
        <span class="flip-hint">tap to flip</span>
        <div class="fc-text" id="card-text"></div>
      </div>
      <div class="flash-actions" id="actions">
        <button class="btn btn-danger" id="revision">🔁 Need revision</button>
        <button class="btn btn-success" id="know">✅ I know this</button>
      </div>
      <div class="mt16 center"><span class="muted" id="summary"></span></div>
    </div>`;

  container.querySelector('#back').onclick = () => app.navigate('flashcards');

  if (cards.length === 0) {
    container.querySelector('#card-text').textContent = 'No cards in this set.';
    container.querySelector('#actions').style.display = 'none';
    return;
  }

  function saveSession() {
    if (sessionsSaved) return;
    sessionsSaved = true;
    api('/progress/session', { method: 'POST', body: { kind: 'flashcards', seconds: Math.round((Date.now() - startedAt) / 1000) } }).catch(() => {});
  }

  function paint() {
    flipped = false;
    container.querySelector('#card-text').className = 'fc-text';
    container.querySelector('#card-text').textContent = cards[idx].front;
    container.querySelector('#count').textContent = `Card ${idx + 1} of ${cards.length}${reviewed > 0 ? ` • reviewed: ${reviewed}` : ''}`;
  }

  container.querySelector('#card').onclick = () => {
    flipped = !flipped;
    const t = container.querySelector('#card-text');
    if (flipped) { t.textContent = cards[idx].back; t.className = 'fc-text small'; }
    else { t.textContent = cards[idx].front; t.className = 'fc-text'; }
  };

  function advance() {
    reviewed++;
    saveSession();
    if (idx < cards.length - 1) { idx++; paint(); }
    else finish();
  }

  container.querySelector('#know').onclick = async () => {
    known++; advance();
    api(`/flashcards/${set.id}/review`, { method: 'POST', body: { card_index: idx, status: 'know' } }).catch(() => {});
  };
  container.querySelector('#revision').onclick = async () => {
    revision++; advance();
    api(`/flashcards/${set.id}/review`, { method: 'POST', body: { card_index: idx, status: 'revision' } }).catch(() => {});
  };

  function finish() {
    saveSession();
    const pct = reviewed ? Math.round((known / reviewed) * 100) : 0;
    container.innerHTML = `
      <div class="screen">
        <div class="center">
          <div class="empty-emoji" style="font-size:70px;">${pct >= 70 ? '🎉' : '💪'}</div>
          <h2>Session complete!</h2>
          <p class="sub">You reviewed ${reviewed} card(s).</p>
          <div class="stat-grid mt16">
            <div class="stat"><div class="stat-num" style="color:var(--success)">${known}</div><div class="stat-label">I know</div></div>
            <div class="stat"><div class="stat-num" style="color:var(--danger)">${revision}</div><div class="stat-label">Need revision</div></div>
          </div>
          <div class="btn-row mt24">
            <button class="btn btn-secondary" id="again">↻ Review again</button>
            <button class="btn btn-primary" id="done">Done</button>
          </div>
        </div>
      </div>`;
    container.querySelector('#done').onclick = () => app.navigate('flashcards');
    container.querySelector('#again').onclick = () => { idx = 0; known = 0; revision = 0; reviewed = 0; sessionsSaved = false; render(container, params, app); };
  }

  paint();
}
