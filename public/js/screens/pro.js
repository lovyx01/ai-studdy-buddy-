import { api } from '../api.js';
import { toast, esc } from '../ui.js';

// Fallback plan data so the page always renders, even offline or if the
// subscription endpoint is slow/unavailable. The backend's /subscription
// payload replaces this when it loads.
const DEFAULT_PLANS = {
  free: {
    id: 'free', name: 'Free', price: 0, period: '/month',
    features: [
      '15 AI tutor messages / day',
      '3 quizzes / month',
      '5 uploaded materials',
      '2 flashcard sets',
      'Basic explanations',
    ],
  },
  pro: {
    id: 'pro', name: 'Pro', price: 4.99, period: '/month',
    features: [
      'Unlimited AI study sessions',
      'Unlimited quizzes & flashcards',
      'More document uploads',
      'Advanced AI explanations',
      'Exam preparation mode',
      'Study analytics',
      'Personalized revision plans',
    ],
  },
};

// Build a side-by-side comparison table from two plans.
function comparison(plans) {
  const free = plans?.free || DEFAULT_PLANS.free;
  const pro = plans?.pro || DEFAULT_PLANS.pro;
  const allFeatures = [...new Set([...(free.features || []), ...(pro.features || [])])];
  const has = (list, f) => (list || []).includes(f);
  const rows = allFeatures.map((f) => `
    <tr>
      <td class="f-name">${esc(f)}</td>
      <td class="col ${has(free.features, f) ? 'yes' : 'no'}">${has(free.features, f) ? '✓' : '—'}</td>
      <td class="col pro ${has(pro.features, f) ? 'yes' : 'no'}">${has(pro.features, f) ? '✓' : '—'}</td>
    </tr>`).join('');

  return `
    <div class="compare-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <th class="corner"></th>
            <th class="col">
              <div class="plan-name">${esc(free.name)}</div>
              <div class="plan-price"><b>$${free.price ?? 0}</b><span>${esc(free.period || '')}</span></div>
            </th>
            <th class="col pro">
              <div class="pro-tag">BEST</div>
              <div class="plan-name pro">${esc(pro.name)}</div>
              <div class="plan-price"><b>$${pro.price ?? 4.99}</b><span>${esc(pro.period || '/month')}</span></div>
            </th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export default async function render(container, params, app) {
  // 1) Render the shell immediately so the page always opens.
  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2>Upgrade to Pro</h2></div>

      <div class="card pro-hero">
        <div class="ph-emoji">👑</div>
        <div>
          <div class="ph-title">Study Buddy Pro</div>
          <div class="ph-sub">Study smarter with unlimited AI — summaries, flashcards, quizzes and a personal AI tutor without limits.</div>
        </div>
      </div>

      <div class="card mt16">
        <h3>Free vs Pro</h3>
        <div id="compare" class="mt8">${comparison(DEFAULT_PLANS)}</div>
      </div>

      <div class="card mt16">
        <h3>Pro features</h3>
        <div id="pro-features">
          ${DEFAULT_PLANS.pro.features.map((f) => `<div class="pro-feature"><div class="pf-icon">✓</div><span>${esc(f)}</span></div>`).join('')}
        </div>
      </div>

      <div class="card mt16" style="text-align:center;">
        <p class="sub" id="pro-note">No payment is processed through this demo — nothing is ever charged.</p>
        <button class="btn btn-primary mt16" id="subscribe">Upgrade to Pro — Coming Soon 🚀</button>
        <p class="sub mt8" id="plan-status">You're currently on the free plan.</p>
      </div>
    </div>`;

  // 2) Attach handlers immediately — the page must respond even if the
  //    subscription API is slow or unreachable.
  container.querySelector('#back').onclick = () => app.navigate('profile');
  container.querySelector('#subscribe').onclick = () => {
    // Intentionally does NOT call any payment endpoint — no charge.
    toast('Pro is coming soon! No payment is set up yet, so your account stays on the free plan. 🚀', 'info');
  };

  // 3) Hydrate with the user's real plan + server plan data (best-effort).
  try {
    const d = await api('/subscription');
    const plan = d.plan || 'free';
    const plans = (d.plans && d.plans.pro) ? d.plans : DEFAULT_PLANS;

    const cmp = container.querySelector('#compare');
    if (cmp) cmp.innerHTML = comparison(plans);

    const status = container.querySelector('#plan-status');
    if (status) {
      status.textContent = plan === 'pro'
        ? "You're on Pro — unlimited AI study! 🎉"
        : "You're currently on the free plan.";
    }
    const btn = container.querySelector('#subscribe');
    if (btn && plan === 'pro') {
      btn.textContent = '✓ You\u2019re on Pro';
      btn.disabled = true;
    }
  } catch (_) {
    // Keep the static comparison + Coming Soon button as rendered.
  }
}
