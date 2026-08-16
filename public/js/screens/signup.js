import { api, setToken, setUser, friendlyError } from '../api.js';
import { toast } from '../ui.js';

export default function render(container, params, app) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">🎓</div>
      <div class="auth-title">Create your account</div>
      <p class="auth-sub">Start studying smarter with your AI tutor</p>

      <form id="signup-form">
        <div class="field">
          <label>Name (optional)</label>
          <input class="input" type="text" name="name" placeholder="Alex" autocomplete="name" />
        </div>
        <div class="field">
          <label>Email</label>
          <input class="input" type="email" name="email" placeholder="you@school.edu" autocomplete="email" required />
        </div>
        <div class="field">
          <label>Password</label>
          <input class="input" type="password" name="password" placeholder="At least 6 characters" autocomplete="new-password" required />
        </div>
        <button class="btn btn-primary mt16" type="submit" id="signup-btn">Create account</button>
      </form>

      <p class="center mt24 sub">Already have an account? <span class="link" id="go-login">Log in</span></p>
    </div>`;

  const form = container.querySelector('#signup-form');
  const btn = container.querySelector('#signup-btn');

  form.onsubmit = async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      const data = await api('/auth/signup', {
        method: 'POST',
        body: { name: form.name.value, email: form.email.value, password: form.password.value },
      });
      setToken(data.token); setUser(data.user);
      toast('Account created! Let\'s start studying 🎉', 'success');
      app.navigate('home');
    } catch (err) {
      toast(friendlyError(err), 'error');
      btn.disabled = false; btn.textContent = 'Create account';
    }
  };

  container.querySelector('#go-login').onclick = () => app.navigate('login');
}
