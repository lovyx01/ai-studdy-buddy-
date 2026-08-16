import { api, friendlyError } from '../api.js';
import { toast } from '../ui.js';

export default function render(container, params, app) {
  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2>New Subject</h2></div>
      <form id="sub-form">
        <div class="field">
          <label>Subject name</label>
          <input class="input" name="name" placeholder="e.g. Biology" required maxlength="40"/>
        </div>
        <div class="field">
          <label>Icon</label>
          <div class="chips" id="icons"></div>
        </div>
        <div class="field">
          <label>Color</label>
          <div class="chips" id="colors"></div>
        </div>
        <button class="btn btn-primary mt16" type="submit" id="create-btn">Create Subject</button>
      </form>
    </div>`;

  container.querySelector('#back').onclick = () => app.navigate('subjects');

  const icons = ['📚','🔬','🧪','🧬','💬','💻','🧮','🌍','🎨','📐','⚗️','⚛️','📈','🎵'];
  const colors = ['#6C5CE7','#00B894','#0984E3','#E17055','#00A8CC','#8E44AD','#16A085','#D63031'];
  let icon = icons[0], color = colors[0];

  const iconWrap = container.querySelector('#icons');
  icons.forEach((i) => {
    const b = document.createElement('button');
    b.className = `chip${i === icon ? ' active' : ''}`; b.textContent = i;
    b.onclick = () => { icon = i; iconWrap.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); b.classList.add('active'); };
    iconWrap.appendChild(b);
  });
  const colorWrap = container.querySelector('#colors');
  colors.forEach((c) => {
    const b = document.createElement('button');
    b.className = `chip${c === color ? ' active' : ''}`;
    b.style.background = c; b.style.color = '#fff'; b.style.borderColor = c;
    b.textContent = '   ';
    b.onclick = () => { color = c; colorWrap.querySelectorAll('.chip').forEach((x) => x.classList.remove('active')); b.classList.add('active'); };
    colorWrap.appendChild(b);
  });

  container.querySelector('#sub-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = container.querySelector('#create-btn');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const r = await api('/subjects', { method: 'POST', body: { name: e.target.name.value, icon, color } });
      toast('Subject created! 🎉', 'success');
      app.navigate('subject', { id: r.subject.id });
    } catch (err) {
      toast(friendlyError(err), 'error');
      btn.disabled = false; btn.textContent = 'Create Subject';
    }
  };
}
