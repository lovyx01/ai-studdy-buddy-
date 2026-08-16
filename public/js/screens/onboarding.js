const SLIDES = [
  { emoji: '🤖', title: 'Meet your AI Study Buddy', sub: 'Your personal AI tutor for studying smarter.' },
  { emoji: '📚', title: 'Turn notes into study material', sub: 'Upload your notes and instantly create summaries, flashcards and quizzes.' },
  { emoji: '🎯', title: 'Prepare for exams', sub: 'Practice, track your progress and find what you need to revise.' },
];

export default function render(container, params, app) {
  let i = 0;

  function paint() {
    const s = SLIDES[i];
    container.innerHTML = `
      <div class="onboard">
        <div class="ob-emoji">${s.emoji}</div>
        <div class="ob-title">${s.title}</div>
        <p class="ob-sub">${s.sub}</p>
        <div class="dots">${SLIDES.map((_, d) => `<span class="${d === i ? 'active' : ''}"></span>`).join('')}</div>
        <button class="btn btn-primary" id="ob-next">${i === SLIDES.length - 1 ? 'Get Started' : 'Next'}</button>
        ${i < SLIDES.length - 1 ? `<button class="btn btn-ghost mt8" id="ob-skip">Skip</button>` : ''}
      </div>`;
    container.querySelector('#ob-next').onclick = () => {
      if (i < SLIDES.length - 1) { i++; paint(); }
      else app.navigate('signup');
    };
    const skip = container.querySelector('#ob-skip');
    if (skip) skip.onclick = () => app.navigate('signup');
  }
  paint();
}
