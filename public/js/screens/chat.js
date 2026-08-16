import { api, friendlyError, getUser } from '../api.js';
import { toast, esc, renderMd, timeAgo } from '../ui.js';

const SUGGESTIONS = [
  'Explain this like I\'m 13',
  'Give me a real example',
  'Quiz me on this topic',
  'Break it into small steps',
];

export default async function render(container, params, app) {
  // List mode: AI Tutor tab with no chat selected.
  if (!params.id) return renderList(container, params, app);
  return renderChat(container, params, app);
}

// ---------------------------------------------------------------- list
async function renderList(container, params, app) {
  container.innerHTML = `
    <div class="screen">
      <div class="page-head">
        <h2>AI Tutor</h2>
        <p class="sub">Ask anything — I'll explain it clearly, step by step.</p>
      </div>
      <button class="btn btn-primary" id="new-chat">+ New Chat</button>
      <h3 class="mt24" style="margin-bottom:10px;">Recent chats</h3>
      <div class="loading-block"><div class="spinner"></div><p>Loading…</p></div>
    </div>`;

  container.querySelector('#new-chat').onclick = async () => {
    try {
      const r = await api('/chats', { method: 'POST', body: { subject_id: params.subject_id || null, title: 'New chat' } });
      app.navigate('chat', { id: r.chat.id, subject_id: params.subject_id || '' });
    } catch (e) { toast(friendlyError(e), 'error'); }
  };

  try {
    const d = await api('/chats');
    container.querySelector('.loading-block').remove();
    if (d.chats.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = `<div class="empty-emoji">🤖</div><div class="empty-title">No conversations yet</div><p class="empty-sub">Start a new chat and ask your AI tutor anything.</p><button class="btn btn-primary btn-sm">Ask a question</button>`;
      empty.querySelector('button').onclick = () => container.querySelector('#new-chat').click();
      container.appendChild(empty);
      return;
    }
    d.chats.forEach((c) => {
      const row = document.createElement('div'); row.className = 'card-row';
      row.innerHTML = `
        <div class="icon-tile" style="background:var(--brand-soft)">💬</div>
        <div class="grow"><div class="card-title">${esc(c.title)}</div><div class="card-sub">${timeAgo(c.created_at)}</div></div>
        <span style="color:var(--muted)">›</span>`;
      row.onclick = () => app.navigate('chat', { id: c.id });
      container.appendChild(row);
    });
  } catch (e) {
    toast(friendlyError(e), 'error');
    container.querySelector('.loading-block').innerHTML = `<p class="sub">Could not load chats.</p>`;
  }
}

// ---------------------------------------------------------------- conversation
async function renderChat(container, params, app) {
  const chatId = params.id;

  // Load chat + messages.
  let chat, messages;
  try {
    const d = await api(`/chats/${chatId}`);
    chat = d.chat; messages = d.messages;
  } catch (e) {
    container.innerHTML = `<div class="screen"><div class="empty"><div class="empty-emoji">😕</div><p class="sub">Chat not found.</p><button class="btn btn-secondary btn-sm mt8" onclick="location.hash='#/chat'">Back</button></div></div>`;
    return;
  }

  let level = 'normal';
  const levelLabels = { beginner: 'Beginner', normal: 'Normal', advanced: 'Advanced' };

  container.innerHTML = `
    <div class="chat-shell">
      <div class="toolbar" style="margin-bottom:6px;">
        <span class="back" id="back">←</span>
        <h2 style="font-size:17px;">🤖 ${esc(chat.title)}</h2>
        <span class="icon-btn" id="rename" title="Rename">✏️</span>
        <span class="icon-btn" id="del" title="Delete">🗑️</span>
      </div>
      <div class="seg" style="margin-bottom:8px;">
        ${['beginner','normal','advanced'].map((l) => `<button data-lvl="${l}" class="${l === level ? 'active' : ''}">${levelLabels[l]}</button>`).join('')}
      </div>

      <div class="chat-log" id="chat-log"></div>

      <div class="suggestion-chips" id="sugs" style="display:none;"></div>

      <div class="chat-input-wrap">
        <input class="input" id="chat-input" placeholder="Ask your tutor anything…" autocomplete="off"/>
        <button class="send-btn" id="send" aria-label="Send">➤</button>
      </div>
    </div>`;

  const logEl = container.querySelector('#chat-log');
  const input = container.querySelector('#chat-input');
  const sendBtn = container.querySelector('#send');
  const sugs = container.querySelector('#sugs');

  // Explain-level switcher.
  container.querySelectorAll('.seg button').forEach((b) => {
    b.onclick = () => {
      level = b.dataset.lvl;
      container.querySelectorAll('.seg button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    };
  });

  // Render initial messages.
  if (messages.length === 0) {
    logEl.innerHTML = `
      <div class="empty" style="padding-top:20px;">
        <div class="empty-emoji">🤖</div>
        <div class="empty-title">Hi! I'm your Study Buddy</div>
        <p class="empty-sub">${params.subject_id ? 'I\'m ready to help with this subject. ' : ''}Ask me anything about your studies — I explain things simply, step by step.</p>
      </div>`;
    showSuggestions();
  } else {
    messages.forEach((m) => appendMessage(m));
    logEl.scrollTop = logEl.scrollHeight;
  }

  function showSuggestions() {
    sugs.style.display = 'flex';
    sugs.innerHTML = SUGGESTIONS.map((s) => `<button class="chip">${s}</button>`).join('');
    sugs.querySelectorAll('.chip').forEach((c) => {
      c.onclick = () => { input.value = c.textContent; send(); };
    });
  }

  function appendMessage(m) {
    if (m.role === 'user') {
      logEl.insertAdjacentHTML('beforeend', `<div class="bubble user">${esc(m.content)}</div>`);
    } else {
      const lvlNote = m.explain_level ? `<span class="exlvl">${levelLabels[m.explain_level] || ''}</span>` : '';
      logEl.insertAdjacentHTML('beforeend', `<div class="bubble ai">${lvlNote}${renderMd(m.content)}</div>`);
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'bubble ai typing'; t.id = 'typing';
    t.innerHTML = `<span></span><span></span><span></span>`;
    logEl.appendChild(t);
    logEl.scrollTop = logEl.scrollHeight;
    return t;
  }

  async function send() {
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    appendMessage({ role: 'user', content });
    const t = showTyping();
    sendBtn.disabled = true;
    try {
      const d = await api(`/chats/${chatId}/message`, {
        method: 'POST',
        body: { content, explain_level: level, material_id: params.material_id || null },
      });
      t.remove();
      appendMessage({ role: 'assistant', content: d.message.content, explain_level: level });
      // Check daily limit warnings.
      if (d.usage && d.usage.limit !== Infinity) {
        const left = d.usage.limit - d.usage.used;
        if (left <= 2 && left > 0) toast(`Free plan: ${left} AI message${left === 1 ? '' : 's'} left today.`, 'info');
      }
    } catch (e) {
      t.remove();
      if (e.status === 429) {
        toast(e.message, 'info');
        sugs.style.display = 'none';
      } else {
        toast(friendlyError(e), 'error');
      }
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };

  container.querySelector('#back').onclick = () => app.navigate('chat');
  container.querySelector('#del').onclick = async () => {
    if (!confirm('Delete this chat?')) return;
    try { await api(`/chats/${chatId}`, { method: 'DELETE' }); toast('Chat deleted.', 'success'); app.navigate('chat'); }
    catch (e) { toast(friendlyError(e), 'error'); }
  };
  container.querySelector('#rename').onclick = async () => {
    const name = prompt('Chat title:', chat.title);
    if (!name || !name.trim()) return;
    try { await api(`/chats/${chatId}`, { method: 'PATCH', body: { title: name } }); chat.title = name; container.querySelector('.toolbar h2').textContent = `🤖 ${name}`; toast('Renamed.', 'success'); }
    catch (e) { toast(friendlyError(e), 'error'); }
  };
}
