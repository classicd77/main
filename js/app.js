// Entry point: routing, sidebar, global search, theme and auto-sync.
import { state, subscribe, fullName, statusById } from './store.js';
import { esc, icon, hydrateIcons, avatar, toast, dayDiff, debounce, normPhone, $, $$ } from './util.js';
import { openLeadForm } from './components.js';
import { syncInbox, scriptReady } from './mailer.js';
import * as dashboard from './views/dashboard.js';
import * as leads from './views/leads.js';
import * as lead from './views/lead.js';
import * as followups from './views/followups.js';
import * as inbox from './views/inbox.js';
import * as emails from './views/emails.js';
import * as filesView from './views/files.js';
import * as reports from './views/reports.js';
import * as settings from './views/settings.js';

const routes = {
  dashboard: (v, p) => dashboard.render(v, p),
  leads: (v, p) => leads.render(v, p),
  pipeline: (v) => leads.renderPipeline(v),
  lead: (v, p, id) => lead.render(v, p, id),
  followups: (v) => followups.render(v),
  inbox: (v) => inbox.render(v),
  emails: (v) => emails.render(v),
  files: (v) => filesView.render(v),
  reports: (v) => reports.render(v),
  settings: (v, p) => settings.render(v, p),
};

const view = $('#view');
let currentKey = '';

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [path, qs] = h.split('?');
  const [name, id] = path.split('/');
  return { name: routes[name] ? name : 'dashboard', id, params: new URLSearchParams(qs || '') };
}

function render({ keepScroll = false } = {}) {
  const { name, id, params } = parseHash();
  const key = name + '/' + (id || '');
  const y = window.scrollY;
  const changed = key !== currentKey;
  currentKey = key;
  if (changed) { view.style.animation = 'none'; void view.offsetWidth; view.style.animation = ''; }
  const out = routes[name](view, params, id);
  const after = () => {
    hydrateIcons(view);
    if (keepScroll && !changed) window.scrollTo(0, y);
    else if (changed) window.scrollTo(0, 0);
  };
  out && out.then ? out.then(after) : after();
  renderFolders();
  $$('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === (name === 'lead' ? 'leads' : name) && !(name === 'leads' && activeFolder())));
  $('#sidebar').classList.remove('open');
}
let folderParam = '';
const activeFolder = () => folderParam;

function renderNavCounts() {
  const open = state.leads.filter((l) => !l.archived && !['won', 'lost'].includes(l.status));
  $('#navLeadCount').textContent = state.leads.filter((l) => !l.archived).length || '';
  $('#navDueCount').textContent = open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) <= 0).length || '';
  $('#navInboxCount').textContent = state.inbox.filter((m) => m.status === 'pending').length || '';
  $('#brandSub').textContent = state.settings.company || 'ניהול לידים והשקעות';
}

function renderFolders() {
  const { name, params } = parseHash();
  folderParam = name === 'leads' ? params.get('folder') || (params.get('archived') ? 'archive' : '') : '';
  const box = $('#folderNav');
  box.innerHTML = state.folders.map((f) => `<a href="#/leads?folder=${f.id}" class="${folderParam === f.id ? 'active' : ''}"><span class="dot" style="background:${f.color}"></span><span class="ellipsis">${esc(f.name)}</span><span class="cnt">${state.leads.filter((l) => l.folderId === f.id && !l.archived).length}</span></a>`).join('')
    + `<a href="#/leads?archived=1" class="${folderParam === 'archive' ? 'active' : ''}"><span class="ic">${icon('archive')}</span><span>ארכיון</span><span class="cnt">${state.leads.filter((l) => l.archived).length}</span></a>`;
}

// Re-render on data changes, but never yank the DOM out from under someone typing.
const onChange = debounce(() => {
  renderNavCounts();
  const a = document.activeElement;
  const typing = a && view.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'date'].includes(a.type)));
  if (!typing) render({ keepScroll: true });
  else renderFolders();
}, 30);
subscribe(onChange);

window.addEventListener('hashchange', () => render());

/* ---------- Global search ---------- */
const gs = $('#globalSearch'), gr = $('#searchResults');
let hits = [], hi = 0;
function drawSearch() {
  const q = gs.value.trim().toLowerCase();
  if (!q) { gr.hidden = true; return; }
  const qp = normPhone(q);
  hits = state.leads.filter((l) => [fullName(l), l.email, l.city, l.profession].join(' ').toLowerCase().includes(q) || (qp.length >= 3 && normPhone(l.phone).includes(qp))).slice(0, 8);
  hi = 0;
  gr.innerHTML = hits.length
    ? hits.map((l, i) => `<button data-i="${i}" class="${i === hi ? 'hl' : ''}">${avatar(l)}<span class="grow"><b>${esc(fullName(l))}</b><div class="small muted">${esc([l.phone, l.city].filter(Boolean).join(' · '))}</div></span><span class="badge"><span class="sw" style="background:${statusById(l.status).color}"></span>${esc(statusById(l.status).label)}</span></button>`).join('')
    : `<div class="muted small" style="padding:10px">לא נמצאו תוצאות</div>`;
  gr.hidden = false;
  $$('button', gr).forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); go(hits[+b.dataset.i]); }));
}
function go(l) { if (!l) return; gs.value = ''; gr.hidden = true; gs.blur(); location.hash = '#/lead/' + l.id; }
gs.addEventListener('input', drawSearch);
gs.addEventListener('focus', drawSearch);
gs.addEventListener('blur', () => setTimeout(() => (gr.hidden = true), 120));
gs.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % Math.max(1, hits.length);
    $$('button', gr).forEach((b, i) => b.classList.toggle('hl', i === hi));
  }
  if (e.key === 'Enter') go(hits[hi]);
  if (e.key === 'Escape') { gs.value = ''; gr.hidden = true; gs.blur(); }
});
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || $('#modalRoot').children.length) return;
  if (e.key === '/') { e.preventDefault(); gs.focus(); }
  if (e.key === 'n' || e.key === 'מ') { e.preventDefault(); openLeadForm(); }
});

/* ---------- Chrome ---------- */
$('#quickAddBtn').addEventListener('click', () => openLeadForm());
$('#quickImportBtn').addEventListener('click', () => (location.hash = '#/inbox'));
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#addFolderBtn').addEventListener('click', () => (location.hash = '#/settings?tab=folders'));

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function themeIcon() { $('#themeToggle').innerHTML = icon(isDark() ? 'sun' : 'moon'); }
$('#themeToggle').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('crm.theme', next); } catch (e) {}
  themeIcon();
  render({ keepScroll: true }); // charts pick up new token colors
});

/* ---------- Auto sync ---------- */
let syncTimer;
function scheduleSync() {
  clearInterval(syncTimer);
  const m = Number(state.settings.autoSyncMin);
  if (!m || !scriptReady() || !state.settings.leadSourceEmail) return;
  syncTimer = setInterval(async () => {
    try { const n = await syncInbox(); if (n) toast(`התקבלו ${n} לידים חדשים במייל`); } catch (e) { console.warn('sync failed', e); }
  }, m * 60000);
}
let syncSig = '';
subscribe(() => {
  const sig = [state.settings.autoSyncMin, state.settings.scriptUrl, state.settings.scriptToken, state.settings.leadSourceEmail].join('|');
  if (sig !== syncSig) { syncSig = sig; scheduleSync(); }
});
syncSig = [state.settings.autoSyncMin, state.settings.scriptUrl, state.settings.scriptToken, state.settings.leadSourceEmail].join('|');
scheduleSync();

/* ---------- Boot ---------- */
hydrateIcons(document);
themeIcon();
renderNavCounts();
render();
