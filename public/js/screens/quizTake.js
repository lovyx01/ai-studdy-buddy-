import { api, friendlyError } from '../api.js';
import { toast, esc } from '../ui.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default async function render(container, params, app) {
  let quiz, questions;
  try {
    const d = await api(`/quizzes/${params.id}`);
    quiz = d.quiz;
    questions = d.questions;
  } catch (e) {
    container.innerHTML = `<div class="screen"><div class="empty"><div class="empty-emoji">😕</div><p class="sub">Quiz not found.</p><button class="btn btn-secondary btn-sm mt8" onclick="location.hash='#/quizGenerate'">Back</button></div></div>`;
    return;
  }

  const answers = new Array(questions.length).fill(undefined);
  let idx = 0;
  const startedAt = Date.now();

  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2 style="font-size:16px;">${esc(quiz.title)}</h2></div>
      <div class="quiz-q-num" id="qnum"></div>
      <div class="quiz-question" id="qtext"></div>
      <div id="options"></div>
      <div class="btn-row mt16">
        <button class="btn btn-secondary" id="prev">← Prev</button>
        <button class="btn btn-primary" id="next">Next →</button>
      </div>
      <div class="mt16 center"><span class="muted" id="flag">Flag for review</span></div>
      <div class="center mt8"><span class="muted" id="progress-label"></span></div>
    </div>`;

  container.querySelector('#back').onclick = () => app.navigate('quizGenerate');

  function paint() {
    container.querySelector('#qnum').textContent = `Question ${idx + 1} of ${questions.length}`;
    container.querySelector('#qtext').textContent = questions[idx].question;
    const optWrap = container.querySelector('#options');
    optWrap.innerHTML = questions[idx].options.map((o, i) => `
      <button class="option${answers[idx] === i ? ' selected' : ''}" data-i="${i}">
        <span class="opt-letter">${LETTERS[i]}</span>${esc(o)}
      </button>`).join('');
    optWrap.querySelectorAll('.option').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.i;
        if (answers[idx] === i) answers[idx] = undefined;
        else answers[idx] = i;
        optWrap.querySelectorAll('.option').forEach((x) => x.classList.remove('selected'));
        if (answers[idx] !== undefined) optWrap.querySelectorAll('.option')[i].classList.add('selected');
        updateNav();
      };
    });
    container.querySelector('#flag').textContent = answers[idx] === undefined ? 'Flag for review' : 'Answered ✓';
    container.querySelector('#progress-label').textContent = `${answers.filter((a) => a !== undefined).length}/${questions.length} answered`;
    updateNav();
  }

  function updateNav() {
    container.querySelector('#prev').disabled = idx === 0;
    const isLast = idx === questions.length - 1;
    container.querySelector('#next').textContent = isLast ? 'Finish ✓' : 'Next →';
  }

  container.querySelector('#prev').onclick = () => { if (idx > 0) { idx--; paint(); } };
  container.querySelector('#next').onclick = () => {
    if (idx < questions.length - 1) { idx++; paint(); }
    else submit();
  };

  async function submit() {
    const unanswered = answers.filter((a) => a === undefined).length;
    if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return;
    const btn = container.querySelector('#next');
    btn.disabled = true; btn.textContent = 'Checking…';
    // Log study time.
    try { api('/progress/session', { method: 'POST', body: { kind: 'quiz', seconds: Math.round((Date.now() - startedAt) / 1000) } }).catch(() => {}); } catch (_) {}
    try {
      const r = await api(`/quizzes/${quiz.id}/attempt`, { method: 'POST', body: { answers } });
      app.navigate('quizResult', { id: quiz.id, score: r.score, total: r.total, percent: r.percent, results: JSON.stringify(r.results) });
    } catch (e) {
      toast(friendlyError(e), 'error');
      btn.disabled = false; btn.textContent = 'Finish ✓';
    }
  }

  paint();
}
