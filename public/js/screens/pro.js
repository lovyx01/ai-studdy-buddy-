import { api, friendlyError } from '../api.js';
import { toast, esc } from '../ui.js';

const PRO_FEATURES = [
  'Unlimited AI study sessions',
  'Unlimited quizzes & flashcards',
  'More document uploads',
  'Advanced AI explanations',
  'Exam preparation mode',
  'Study analytics',
  'Personalized revision plans',
];

export default async function render(container, params, app) {
  let plan = 'free', subscription = null, plans = {};
  try {
    const d = await api('/subscription');
    plan = d.plan; subscription = d.subscription; plans = d.plans;
  } catch (_) {}

  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2>Upgrade to Pro</h2></div>

      <div class="card" style="background:linear-gradient(135deg,#6C5CE7,#00B894);color:#fff;text-align:center;">
        <div style="font-size:42px;margin-bottom:6px;">👑</div>
        <div style="font-size:24px;font-weight:800;">Study Buddy Pro</div>
        <div style="font-size:15px;opacity:.95;">Study smarter with unlimited AI</div>
      </div>

      <div class="card mt16">
        <h3>Pro features</h3>
        ${PRO_FEATURES.map((f) => `<div class="pro-feature"><div class="pf-icon">✓</div><span>${f}</span></div>`).join('')}
      </div>

      <div class="card">
        <div style="display:flex;align-items:baseline;gap:8px;">
          <span style="font-size:34px;font-weight:800;">$${plans.pro?.price || 4.99}</span>
          <span class="sub">${plans.pro?.period || '/month'}</span>
        </div>
        <p class="sub mt8">Cancel anytime. A real payment provider is connected at launch — no card is charged through this demo.</p>
        <button class="btn btn-primary mt16" id="subscribe" ${plan === 'pro' ? 'disabled' : ''}>${plan === 'pro' ? '✓ You\'re on Pro' : 'Subscribe to Pro'}</button>
      </div>
    </div>`;

  container.querySelector('#back').onclick = () => app.navigate('profile');

  container.querySelector('#subscribe').onclick = async () => {
    const btn = container.querySelector('#subscribe');
    btn.disabled = true; btn.textContent = 'Connecting to payment…';
    try {
      const r = await api('/subscription/checkout', { method: 'POST', body: {} });
      // On success the API would return a checkout URL to redirect to.
      if (r.url) { window.location.href = r.url; return; }
      toast(r.message || 'Payment provider is not connected yet.', 'info');
      btn.disabled = false; btn.textContent = 'Subscribe to Pro';
    } catch (e) {
      toast(e.data?.message || friendlyError(e), 'info');
      btn.disabled = false; btn.textContent = 'Subscribe to Pro';
    }
  };
}
