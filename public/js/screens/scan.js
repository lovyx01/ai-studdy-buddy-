import { api, friendlyError, API } from '../api.js';
import { toast, esc, renderMd, API_URL, uploadIconPreview, timeAgo } from '../ui.js';

const GEN_OPTIONS = [
  { kind: 'summary', icon: '📝', label: 'Summary' },
  { kind: 'keypoints', icon: '🎯', label: 'Key points' },
  { kind: 'flashcards', icon: '🧠', label: 'Flashcards' },
  { kind: 'mcqs', icon: '✅', label: 'MCQs' },
  { kind: 'quiz', icon: '❓', label: 'Quiz' },
  { kind: 'definitions', icon: '📖', label: 'Definitions' },
  { kind: 'revision', icon: '🗂️', label: 'Revision notes' },
];

export default async function render(container, params, app) {
  // If a material is selected, show its analysis screen.
  if (params.material_id) return renderAnalysis(container, params, app);
  renderUpload(container, params, app);
}

// ---------------------------------------------------------------- upload
function renderUpload(container, params, app) {
  container.innerHTML = `
    <div class="screen">
      <div class="toolbar"><span class="back" id="back">←</span><h2>${params.subject_id ? 'Add Material' : 'Study Notes'}</h2></div>
      <p class="sub">${params.subject_id ? 'Upload a file or paste text for this subject.' : 'Upload notes and instantly create summaries, flashcards and quizzes.'}</p>

      <div class="upload-target mt16" id="drop">
        <div class="ut-icon">📸</div>
        <h3>Upload an image, PDF</h3>
        <p class="sub">or take a photo of your notes</p>
      </div>
      <input type="file" id="file" class="file-input" accept="image/*,.pdf" />

      <div class="divider">or paste your notes</div>
      <textarea class="input" id="text" placeholder="Paste your study notes here…"></textarea>
      <button class="btn btn-primary mt16" id="submit">Analyze material</button>
    </div>`;

  const back = container.querySelector('#back');
  back.onclick = () => (params.subject_id ? app.navigate('subject', { id: params.subject_id }) : app.navigate('home'));

  const fileInput = container.querySelector('#file');
  const drop = container.querySelector('#drop');
  let pendingFile = null;

  drop.onclick = () => fileInput.click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('dragover'); };
  drop.ondragleave = () => drop.classList.remove('dragover');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
  fileInput.onchange = () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); };

  function handleFile(f) {
    const ok = f.type === 'application/pdf' || f.type.startsWith('image/');
    if (!ok) { toast('Please choose a PDF or an image.', 'error'); return; }
    if (f.size > 8 * 1024 * 1024) { toast('File is too large (max 8MB).', 'error'); return; }
    pendingFile = f;
    drop.innerHTML = `<div class="ut-icon">📄</div><h3>${esc(f.name)}</h3><p class="sub">${(f.size / 1024 / 1024).toFixed(1)} MB — ready to analyze</p>`;
  }

  container.querySelector('#submit').onclick = async () => {
    const btn = container.querySelector('#submit');
    const text = container.querySelector('#text').value.trim();
    if (!pendingFile && !text) { toast('Please upload a file or enter some text first.', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Analyzing your notes…';
    try {
      const fd = new FormData();
      if (pendingFile) fd.append('file', pendingFile);
      else fd.append('text', text);
      if (params.subject_id) fd.append('subject_id', params.subject_id);
      fd.append('title', pendingFile ? pendingFile.name : 'My notes');
      const r = await api('/materials', { method: 'POST', body: fd });
      toast('Material saved! What would you like to do with it?', 'success');
      app.navigate('scan', { material_id: r.material.id, subject_id: params.subject_id || '' });
    } catch (e) {
      toast(friendlyError(e), 'error');
      btn.disabled = false; btn.textContent = 'Analyze material';
    }
  };
}

// ---------------------------------------------------------------- analysis
async function renderAnalysis(container, params, app) {
  let material;
  try { material = (await api(`/materials/${params.material_id}`)).material; }
  catch (e) { container.innerHTML = `<div class="screen"><div class="empty"><p class="sub">Material not found.</p></div></div>`; return; }

  container.innerHTML = `
    <div class="screen">
      <div class="toolbar">
        <span class="back" id="back">←</span>
        <h2 style="font-size:17px;">${esc(material.title)}</h2>
        <span class="icon-btn" id="del" title="Delete">🗑️</span>
      </div>

      ${material.kind === 'image' ? `<div class="card" style="padding:10px;">${uploadIconPreview(material) || '<p class="sub center">Image</p>'}</div>` : ''}
      <div class="card" style="padding:10px;">
        <p class="sub" style="font-size:13px;color:var(--muted)">${material.kind} • added ${timeAgo(material.created_at)}</p>
        ${material.content ? `<div style="max-height:140px;overflow-y:auto;font-size:14px;color:var(--text-soft);margin-top:6px;white-space:pre-wrap;">${esc(material.content.slice(0, 1200))}${material.content.length > 1200 ? '…' : ''}</div>` : '<p class="sub mt8">No text extracted from this file. You can ask the AI tutor to read it, or paste the text.</p>'}
      </div>

      <h3 style="margin-bottom:12px;">What would you like to do with these notes?</h3>
      <div class="grid-2" id="gen-grid"></div>

      <div id="output" class="mt16"></div>
    </div>`;

  const back = container.querySelector('#back');
  back.onclick = () => (params.subject_id ? app.navigate('subject', { id: params.subject_id }) : app.navigate('home'));

  container.querySelector('#del').onclick = async () => {
    if (!confirm('Delete this material?')) return;
    try { await api(`/materials/${material.id}`, { method: 'DELETE' }); toast('Deleted.', 'success'); app.navigate('subjects'); }
    catch (e) { toast(friendlyError(e), 'error'); }
  };

  // Fill generate grid.
  const grid = container.querySelector('#gen-grid');
  GEN_OPTIONS.forEach((g) => {
    const b = document.createElement('button');
    b.className = 'gen-btn';
    b.innerHTML = `<span class="g-icon">${g.icon}</span>${g.label}`;
    b.onclick = () => generate(g);
    grid.appendChild(b);
  });

  // "Ask AI about these notes" button.
  const ask = document.createElement('button');
  ask.className = 'btn btn-secondary mt16';
  ask.textContent = '🤖 Ask the AI tutor about these notes';
  ask.onclick = () => app.navigate('chat', { material_id: material.id });
  container.querySelector('#gen-grid').after(ask);

  async function generate(g) {
    const out = container.querySelector('#output');
    out.innerHTML = `<div class="loading-block"><div class="spinner"></div><p>Creating your ${g.label.toLowerCase()}…</p></div>`;
    try {
      const r = await api(`/materials/${material.id}/generate`, { method: 'POST', body: { kind: g.kind } });
      out.innerHTML = `<div class="card"><h3>${g.icon} ${esc(g.label)}</h3><div class="divider-line"></div><div style="font-size:15px;">${renderResult(g.kind, r.output)}</div>
        <button class="btn btn-secondary btn-sm mt16" id="copy">Copy</button></div>`;
      out.querySelector('#copy').onclick = () => {
        const text = typeof r.output === 'string' ? r.output : JSON.stringify(r.output, null, 2);
        navigator.clipboard?.writeText(text);
        toast('Copied to clipboard.', 'success');
      };
      // Flashcards / quiz / mcqs can be turned into reusable study items.
      if (g.kind === 'flashcards') await saveFlashcards(r.output);
      if (g.kind === 'quiz' || g.kind === 'mcqs') await saveQuiz(r.output, g.kind);
    } catch (e) {
      out.innerHTML = `<div class="card"><p class="sub">${esc(friendlyError(e))}</p></div>`;
    }
  }

  async function saveFlashcards(output) {
    const cards = (output && output.cards) || [];
    if (!cards.length) return;
    try {
      const r = await api('/flashcards', { method: 'POST', body: { subject_id: params.subject_id || null, title: `${material.title} — Flashcards`, cards } });
      toast(`Saved ${cards.length} flashcards! 🧠`, 'success');
      setTimeout(() => { if (confirm('Open these flashcards now?')) app.navigate('flashcardStudy', { id: r.set.id }); }, 400);
    } catch (e) { toast(friendlyError(e), 'error'); }
  }

  async function saveQuiz(output, kind) {
    const questions = (output && output.questions) || [];
    if (!questions.length) return;
    try {
      const r = await api('/quizzes/save', {
        method: 'POST',
        body: { subject_id: params.subject_id || null, topic: `${material.title} (${kind})`, difficulty: 'easy', title: `${material.title} — ${kind === 'mcqs' ? 'MCQs' : 'Quiz'}`, questions },
      });
      toast(`Saved ${questions.length}-question quiz! ❓`, 'success');
      setTimeout(() => { if (confirm('Take this quiz now?')) app.navigate('quizTake', { id: r.quiz.id }); }, 400);
    } catch (e) { toast(friendlyError(e), 'error'); }
  }
}

function renderResult(kind, output) {
  if (kind === 'flashcards' || kind === 'mcqs' || kind === 'quiz') {
    if (kind === 'flashcards') {
      const cards = output?.cards || [];
      return cards.map((c) => `<div class="review-item"><b>❓ ${esc(c.front)}</b><br/><span class="sub">${esc(c.back)}</span></div>`).join('') || '<p class="sub">No cards generated.</p>';
    }
    const qs = output?.questions || [];
    return qs.map((q, i) => `<div class="review-item"><span class="badge no">Q${i + 1}</span> <b>${esc(q.question)}</b><div class="sub">${(q.options || []).map((o) => '• ' + esc(o)).join('<br/>')}</div><p class="sub" style="color:var(--success);margin-top:4px;">✓ ${esc(q.explanation)}</p></div>`).join('');
  }
  return renderMd(output);
}
