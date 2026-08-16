// Small DOM / UI helpers used across screens.

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Minimal markdown-ish renderer for AI output (bold, bullets, headings).
export function renderMd(s) {
  if (!s) return '';
  let out = esc(s);
  out = out.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  out = out.replace(/^## (.*)$/gm, '<h3>$1</h3>');
  out = out.replace(/^# (.*)$/gm, '<h3>$1</h3>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/`(.+?)`/g, '<code>$1</code>');
  out = out.replace(/^- (.*)$/gm, '<div style="padding-left:14px;text-indent:-8px;">•&nbsp;$1</div>');
  out = out.replace(/\n{2,}/g, '<br/>');
  return out;
}

let toastTimer = null;
export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function minutesLabel(sec) {
  if (!sec) return '0 min';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// A circular "score" element.
export function scoreCircle(percent) {
  const p = Math.max(0, Math.min(100, percent));
  const color = p >= 70 ? 'var(--success)' : p >= 40 ? 'var(--warn)' : 'var(--danger)';
  return `<div class="score-circle" style="--pct:${p}%;background:conic-gradient(${color} ${p}%, var(--border) 0);">
      <div class="score-val"><span class="num">${p}%</span><span class="lbl">score</span></div>
    </div>`;
}

import { API } from './api.js';

// Serve an uploaded image via the owner-scoped route.
export function API_URL(material) {
  if (!material || !material.id) return '';
  return `${API}/api/materials/${material.id}/file`;
}

export function uploadIconPreview(material) {
  if (material.kind === 'image' && material.file_path) {
    return `<img src="${API_URL(material)}" style="width:100%;max-height:150px;object-fit:cover;border-radius:12px;border:1px solid var(--border);"/>`;
  }
  return null;
}
