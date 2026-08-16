import { scoreCircle, esc } from '../ui.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function render(container, params, app) {
  let results = [];
  try { results = JSON.parse(params.results || '[]'); } catch (_) {}
  const percent = Number(params.percent || 0);
  const total = Number(params.total || results.length || 0);

  const verdict = percent >= 70 ? 'Great job! 🎉' : percent >= 40 ? 'Good effort — keep practicing 💪' : 'Let\'s review and try again 📚';
  const msg = percent >= 70 ? 'You\'ve got this topic down. Nice work!' : percent >= 40 ? 'You\'re making progress. Review the explanations below.' : 'Review the explanations below and retake the quiz. You\'ll improve!';

  container.innerHTML = `
    <div class="screen">
      <div class="center">
        <h2>Quiz Complete</h2>
        ${scoreCircle(percent)}
        <h3>${verdict}</h3>
        <p class="sub">${msg}</p>
        <div class="stat-grid mt16">
          <div class="stat"><div class="stat-num">${params.score}/${total}</div><div class="stat-label">Correct</div></div>
          <div class="stat"><div class="stat-num" style="color:var(--danger)">${total - Number(params.score || 0)}</div><div class="stat-label">Incorrect</div></div>
        </div>
      </div>

      <h3 class="mt24" style="margin-bottom:10px;">Review & explanations</h3>
      <div id="review"></div>

      <div class="btn-row mt16">
        <button class="btn btn-secondary" id="retry">↻ Retake</button>
        <button class="btn btn-primary" id="done">Done</button>
      </div>
    </div>`;

  const review = container.querySelector('#review');
  if (results.length === 0) {
    review.innerHTML = `<p class="sub">No detailed results available.</p>`;
  } else {
    results.forEach((r, i) => {
      const chosen = r.chosen;
      const isCorrect = r.correct;
      const card = document.createElement('div');
      card.className = 'review-item';
      let chosenLine;
      if (chosen === undefined || chosen === null) {
        chosenLine = `<span class="badge no">Not answered</span>`;
      } else if (isCorrect) {
        chosenLine = `<span class="badge ok">Your answer: ${LETTERS[chosen]}</span>`;
      } else {
        chosenLine = `<span class="badge no">Your answer: ${LETTERS[chosen]} (wrong)</span>`;
      }
      card.innerHTML = `
        <div class="rq">${i + 1}. ${esc(r.question)} ${isCorrect ? '<span class="badge ok">✓ Correct</span>' : '<span class="badge no">✗ Incorrect</span>'}</div>
        <div class="sub" style="margin-bottom:6px;">${(r.options || []).map((o, j) => {
          let cls = '';
          if (j === r.correctIndex) cls = 'style="color:var(--success);font-weight:700;"';
          else if (j === chosen && !isCorrect) cls = 'style="color:var(--danger);"';
          return `<div ${cls}>${LETTERS[j]}. ${esc(o)}${j === r.correctIndex ? ' ✓' : ''}</div>`;
        }).join('')}</div>
        ${chosenLine}
        <div class="divider-line"></div>
        <p class="sub"><b style="color:var(--text)">Why:</b> ${esc(r.explanation || 'No explanation.')}</p>`;
      review.appendChild(card);
    });
  }

  container.querySelector('#retry').onclick = () => app.navigate('quizTake', { id: params.id });
  container.querySelector('#done').onclick = () => app.navigate('quizGenerate');
}
