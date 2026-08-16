import { api, setToken, setUser, friendlyError } from '../api.js';
import { toast, el } from '../ui.js';

export default function render(container, params, app) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">🎓</div>
      <div class="auth-title">Welcome back</div>
      <p class="auth-sub">Log in to continue studying</p>

      <form id="login-form">
        <div class="field">
          <label>Email</label>
          <input class="input" type="email" name="email" placeholder="you@school.edu" autocomplete="email" required />
        </div>
        <div class="field">
          <label>Password</label>
          <input class="input" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required />
        </div>
        <div class="center"><span class="link" id="forgot">Forgot password?</span></div>
        <button class="btn btn-primary mt16" type="submit" id="login-btn">Log in</button>
      </form>

      <div class="divider">or</div>
      <button class="btn btn-secondary" id="google-btn">🔵 Continue with Google</button>

      <p class="center mt24 sub">New to Study Buddy? <span class="link" id="go-signup">Create an account</span></p>
    </div>`;

  const form = container.querySelector('#login-form');
  const btn = container.querySelector('#login-btn');

  form.onsubmit = async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = 'Logging in…';
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: form.email.value, password: form.password.value },
      });
      setToken(data.token); setUser(data.user);
      toast(`Welcome back${data.user.name ? ', ' + data.user.name : ''}! 👋`, 'success');
      app.navigate('home');
    } catch (err) {
      toast(friendlyError(err), 'error');
      btn.disabled = false; btn.textContent = 'Log in';
    }
  };

  container.querySelector('#forgot').onclick = () => app.navigate('forgot');
  container.querySelector('#go-signup').onclick = () => app.navigate('signup');
  container.querySelector('#google-btn').onclick = () => {
    toast('Google sign-in is ready to connect. See the README to enable it.', 'info');
  };
}
