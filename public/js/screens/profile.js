import { api, getUser, setToken, setUser, friendlyError, API } from '../api.js';
import { toast, esc } from '../ui.js';

export default async function render(container, params, app) {
  const user = getUser();
  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  container.innerHTML = `
    <div class="screen">
      <div class="page-head"><h2>Profile</h2></div>

      <div class="card" style="display:flex;align-items:center;gap:14px;">
        <div class="avatar">${esc(initial)}</div>
        <div style="flex:1;">
          <div style="font-weight:800;font-size:17px;">${esc(user?.name || 'Student')}</div>
          <div class="sub">${esc(user?.email || '')}</div>
        </div>
        <span class="plan-badge" id="plan-badge">${(user?.plan || 'free').toUpperCase()}</span>
      </div>

      <div class="card mt16" id="usage-card">
        <h3>This session</h3>
        <div class="loading-block"><div class="spinner"></div></div>
      </div>

      <div class="card mt16">
        <h3>Settings</h3>
        <div class="kv"><span class="k">AI explain level</span><span class="link" id="explain">Set in AI Tutor →</span></div>
        <div class="kv"><span class="k">Upgrade to Pro</span><span class="link" id="pro">View plans →</span></div>
        <div class="kv"><span class="k">Log out</span><span class="link" id="logout">Log out</span></div>
      </div>

      <div class="card mt16">
        <h3>About</h3>
        <div class="kv"><span class="k">App</span><span>AI Study Buddy v1.0</span></div>
        <div class="kv"><span class="k">Server</span><span id="server-url">${esc(API)}</span></div>
      </div>
    </div>`;

  // Attach static handlers immediately so taps always work, even if the
  // subscription API is slow or unreachable.
  container.querySelector('#explain').onclick = () => app.navigate('chat');
  container.querySelector('#pro').onclick = () => app.navigate('pro');
  container.querySelector('#logout').onclick = () => {
    setToken(null); setUser(null);
    toast('Logged out. See you soon! 👋', 'info');
    app.navigate('login');
  };

  // Load usage / plan (best-effort, async).
  try {
    const sub = await api('/subscription');
    const planName = (sub.plan === 'pro' ? 'PRO' : 'FREE');
    const badge = container.querySelector('#plan-badge');
    badge.textContent = planName;
    badge.classList.toggle('pro', sub.plan === 'pro');

    const usage = container.querySelector('#usage-card');
    if (sub.plan === 'pro') {
      usage.innerHTML = `<h3 style="margin-bottom:6px;">Plan</h3><p class="sub">You're on Pro — unlimited AI study! 🎉</p>`;
    } else {
      usage.innerHTML = `<h3 style="margin-bottom:10px;">Free plan usage</h3>
        <p class="sub">Upgrade to Pro to unlock everything.</p>
        <button class="btn btn-primary mt16" id="upgrade">Upgrade to Pro</button>`;
      usage.querySelector('#upgrade').onclick = () => app.navigate('pro');
    }
  } catch (e) { /* keep static profile */ }
}
