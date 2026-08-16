import { api, friendlyError } from '../api.js';
import { toast } from '../ui.js';

export default function render(container, params, app) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">🔑</div>
      <div class="auth-title">Reset password</div>
      <p class="auth-sub">Enter your email and we'll send you a reset link</p>

      <form id="forgot-form">
        <div class="field">
          <label>Email</label>
          <input class="input" type="email" name="email" placeholder="you@school.edu" autocomplete="email" required />
        </div>
        <button class="btn btn-primary mt16" type="submit" id="forgot-btn">Send reset link</button>
      </form>
      <p class="center mt24 sub"><span class="link" id="go-login">← Back to log in</span></p>
    </div>`;

  const form = container.querySelector('#forgot-form');
  const btn = container.querySelector('#forgot-btn');

  form.onsubmit = async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const data = await api('/auth/forgot', { method: 'POST', body: { email: form.email.value } });
      toast(data.message, 'success');
      // MVP demo flow: show the returned one-time reset token so it can be tested
      // without an SMTP provider. In production this is emailed, not shown.
      if (data.resetToken) {
        container.querySelector('#reset-box')?.remove();
        const box = document.createElement('div');
        box.id = 'reset-box';
        box.className = 'card mt16';
        box.innerHTML = `<h3>Demo reset link</h3>
          <p class="sub">For testing without email, use the token below to set a new password:</p>
          <input class="input mt8" readonly value="${data.resetToken}" onclick="this.select()" style="font-size:11px;"/>
          <div class="field mt8"><label>New password</label>
          <input class="input" type="password" id="new-pass" placeholder="At least 6 characters"/></div>
          <button class="btn btn-primary btn-sm mt8" id="reset-go">Set new password</button>`;
        form.after(box);
        box.querySelector('#reset-go').onclick = async () => {
          const pass = box.querySelector('#new-pass').value;
          if (pass.length < 6) return toast('Password must be at least 6 characters.', 'error');
          try {
            await api('/auth/reset', { method: 'POST', body: { token: data.resetToken, password: pass } });
            toast('Password updated! Please log in.', 'success');
            app.navigate('login');
          } catch (e) { toast(friendlyError(e), 'error'); }
        };
      }
      btn.disabled = false; btn.textContent = 'Send reset link';
    } catch (err) {
      toast(friendlyError(err), 'error');
      btn.disabled = false; btn.textContent = 'Send reset link';
    }
  };

  container.querySelector('#go-login').onclick = () => app.navigate('login');
}
