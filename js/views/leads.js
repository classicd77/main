import { state, save, STATUSES, PIPELINE, HORIZONS, GOALS, SOURCES, fullName, leadScore, updateLead, deleteLeads, statusById, getLead } from '../store.js';
import { esc, icon, fmtMoney, fmtMoneyShort, fmtPct, fmtDate, timeAgo, avatar, dueBadge, confirmDialog, toast, downloadBlob, toCSV, debounce, $, $$ } from '../util.js';
import { statusBadge, prioBadge, folderBadge, folderOf, openLeadForm, openComposer } from '../components.js';
import { sum } from '../metrics.js';

// UI state survives re-renders
let lastParams = null;
const ui = { q: '', status: '', folder: '', source: '', goal: '', horizon: '', archived: false, sort: 'createdAt', dir: -1, sel: new Set() };

export const CSV_COLUMNS = [
  ['שם פרטי', (l) => l.firstName], ['שם משפחה', (l) => l.lastName], ['עיר מגורים', (l) => l.city], ['טלפון נייד', (l) => l.phone],
  ['אימייל', (l) => l.email], ['גיל', (l) => l.age], ['מקצוע', (l) => l.profession], ['טווח השקעה', (l) => l.horizon],
  ['מטרת ההשקעה', (l) => l.goal], ['סכום', (l) => l.amount], ['דמי ניהול %', (l) => l.fee], ['סטטוס', (l) => statusById(l.status).label],
  ['עדיפות', (l) => ({ high: 'גבוהה', med: 'בינונית', low: 'נמוכה' }[l.priority] || '')], ['מקור', (l) => l.source],
  ['תיק', (l) => folderOf(l.folderId)?.name || ''], ['תגיות', (l) => (l.tags || []).join(' | ')], ['מעקב הבא', (l) => l.nextFollowUp],
  ['ציון', (l) => leadScore(l)], ['נוצר', (l) => fmtDate(l.createdAt)], ['עודכן', (l) => fmtDate(l.updatedAt)], ['פירוט השיחה', (l) => l.conversation],
];
export const exportCSV = (leads, name = 'leads') => downloadBlob(new Blob([toCSV([CSV_COLUMNS.map((c) => c[0]), ...leads.map((l) => CSV_COLUMNS.map((c) => c[1](l)))])], { type: 'text/csv;charset=utf-8' }), `${name}-${new Date().toISOString().slice(0, 10)}.csv`);

function filtered() {
  const q = ui.q.trim().toLowerCase();
  let list = state.leads.filter((l) => !!l.archived === ui.archived);
  if (ui.status) list = list.filter((l) => l.status === ui.status);
  if (ui.folder) list = list.filter((l) => (ui.folder === 'none' ? !l.folderId || !folderOf(l.folderId) : l.folderId === ui.folder));
  if (ui.source) list = list.filter((l) => l.source === ui.source);
  if (ui.goal) list = list.filter((l) => l.goal === ui.goal);
  if (ui.horizon) list = list.filter((l) => l.horizon === ui.horizon);
  if (q) list = list.filter((l) => [l.firstName, l.lastName, l.city, l.phone, l.email, l.profession, l.goal, ...(l.tags || [])].join(' ').toLowerCase().includes(q));
  const k = ui.sort;
  const val = (l) => (k === 'name' ? fullName(l) : k === 'score' ? leadScore(l) : k === 'amount' || k === 'fee' || k === 'age' ? Number(l[k]) || 0 : k === 'status' ? STATUSES.findIndex((s) => s.id === l.status) : l[k] || '');
  return list.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * ui.dir; });
}

const sel = (name, list, val, all) =>
  `<select class="input sm" data-f="${name}"><option value="">${all}</option>${list.map((o) => `<option value="${esc(o.id ?? o)}" ${val === (o.id ?? o) ? 'selected' : ''}>${esc(o.label ?? o.name ?? o)}</option>`).join('')}</select>`;

export function render(view, params) {
  // URL params (from dashboard/sidebar links) set the filters when the link changes
  if (params.toString() !== lastParams) {
    lastParams = params.toString();
    if (lastParams) Object.assign(ui, { status: params.get('status') || '', folder: params.get('folder') || '', archived: params.get('archived') === '1', source: '', goal: '', horizon: '', q: '' });
    else Object.assign(ui, { folder: '', archived: false });
    ui.sel.clear();
  }
  const list = filtered();
  const folder = ui.folder && ui.folder !== 'none' ? folderOf(ui.folder) : null;
  ui.sel = new Set([...ui.sel].filter((id) => getLead(id)));
  const th = (k, label) => `<th class="sortable" data-sort="${k}">${label}${ui.sort === k ? icon(ui.dir > 0 ? 'arrowUp' : 'arrowDown') : ''}</th>`;

  view.innerHTML = `
    <div class="page-head">
      <div><h1>${ui.archived ? 'ארכיון לידים' : folder ? esc(folder.name) : 'לידים'}</h1><div class="sub">${list.length} לידים · סכום כולל ${fmtMoneyShort(sum(list, (l) => l.amount))}</div></div>
      <span class="spacer"></span>
      <div class="seg"><button class="${ui.archived ? '' : 'on'}" data-arch="0">פעילים</button><button class="${ui.archived ? 'on' : ''}" data-arch="1">${icon('archive')}ארכיון</button></div>
      <button class="btn" data-act="csv">${icon('download')}ייצוא לאקסל</button>
      <button class="btn primary" data-act="add">${icon('plus')}ליד חדש</button>
    </div>
    <div class="toolbar">
      <div class="search" style="max-width:280px"><span>${icon('search')}</span><input id="lq" type="search" placeholder="סינון מהיר…" value="${esc(ui.q)}"></div>
      ${sel('status', STATUSES, ui.status, 'כל הסטטוסים')}
      ${sel('folder', [...state.folders, { id: 'none', name: 'ללא תיק' }], ui.folder, 'כל התיקים')}
      ${sel('source', SOURCES, ui.source, 'כל המקורות')}
      ${sel('goal', GOALS, ui.goal, 'כל המטרות')}
      ${sel('horizon', HORIZONS, ui.horizon, 'כל הטווחים')}
      ${ui.status || ui.folder || ui.source || ui.goal || ui.horizon || ui.q ? `<button class="btn sm ghost" data-act="clear">${icon('x')}ניקוי</button>` : ''}
    </div>
    ${ui.sel.size ? `<div class="bulkbar">
      <b>${ui.sel.size} נבחרו</b><span class="spacer"></span>
      <select class="input sm" data-bulk="status"><option value="">שינוי סטטוס…</option>${STATUSES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select>
      <select class="input sm" data-bulk="folder"><option value="">תיוק לתיק…</option>${state.folders.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}<option value="__none">הוצאה מתיק</option></select>
      <button class="btn sm" data-bulk-act="email">${icon('mail')}מייל</button>
      <button class="btn sm" data-bulk-act="csv">${icon('download')}ייצוא</button>
      <button class="btn sm" data-bulk-act="archive">${icon('archive')}${ui.archived ? 'שחזור' : 'לארכיון'}</button>
      <button class="btn sm" data-bulk-act="delete">${icon('trash')}מחיקה</button>
    </div>` : ''}
    ${list.length ? `<div class="table-wrap"><table class="tbl">
      <thead><tr><th class="chk"><input type="checkbox" class="check" id="selAll" ${ui.sel.size && ui.sel.size === list.length ? 'checked' : ''}></th>
        ${th('name', 'שם')}${th('status', 'סטטוס')}${th('amount', 'סכום')}${th('fee', 'דמי ניהול')}<th>מטרה / טווח</th><th>תיק</th>${th('score', 'ציון')}${th('nextFollowUp', 'מעקב הבא')}${th('createdAt', 'נוצר')}</tr></thead>
      <tbody>${list.map((l) => `
        <tr data-id="${l.id}" class="${ui.sel.has(l.id) ? 'sel' : ''}">
          <td class="chk"><input type="checkbox" class="check" data-sel="${l.id}" ${ui.sel.has(l.id) ? 'checked' : ''}></td>
          <td><div class="who">${avatar(l)}<div style="min-width:0"><div class="n ellipsis">${esc(fullName(l))} ${l.priority === 'high' ? `<span class="prio high" title="עדיפות גבוהה">${icon('flag')}</span>` : ''}</div><div class="s ellipsis">${esc([l.city, l.phone].filter(Boolean).join(' · '))}</div>${(l.tags || []).length ? `<div class="row wrap" style="gap:4px;margin-top:3px">${l.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div></div></td>
          <td>${statusBadge(l.status)}</td>
          <td class="num"><b>${l.amount ? fmtMoney(l.amount) : '—'}</b></td>
          <td class="num">${l.fee !== '' && l.fee != null ? fmtPct(l.fee, 2) : '—'}</td>
          <td><div class="small">${esc(l.goal || '—')}</div><div class="small muted">${esc(l.horizon || '')}</div></td>
          <td>${folderBadge(l.folderId)}</td>
          <td><span class="score"><span class="score-bar"><i style="width:${leadScore(l)}%"></i></span><span class="small num">${leadScore(l)}</span></span></td>
          <td>${l.nextFollowUp ? dueBadge(l.nextFollowUp) : '<span class="muted">—</span>'}</td>
          <td class="small muted">${timeAgo(l.createdAt)}</td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div class="card"><div class="empty"><div class="big">${icon('users')}</div><h3>${state.leads.length ? 'לא נמצאו לידים' : 'עדיין אין לידים'}</h3><div>${state.leads.length ? 'נסו לשנות את הסינון' : 'הוסיפו ליד ידנית, קלטו ממייל, או טענו נתוני הדגמה בהגדרות'}</div></div></div>`}`;

  const rerender = () => render(view, new URLSearchParams(location.hash.split('?')[1] || ''));
  const q = $('#lq', view);
  q?.addEventListener('input', debounce(() => { ui.q = q.value; rerender(); $('#lq', view).focus(); const v = $('#lq', view); v.selectionStart = v.selectionEnd = v.value.length; }, 180));
  $$('[data-f]', view).forEach((s) => s.addEventListener('change', () => { ui[s.dataset.f] = s.value; rerender(); }));
  $$('[data-arch]', view).forEach((b) => b.addEventListener('click', () => { ui.archived = b.dataset.arch === '1'; ui.sel.clear(); rerender(); }));
  $$('[data-sort]', view).forEach((h) => h.addEventListener('click', () => { if (ui.sort === h.dataset.sort) ui.dir *= -1; else { ui.sort = h.dataset.sort; ui.dir = -1; } rerender(); }));
  $('[data-act="clear"]', view)?.addEventListener('click', () => { Object.assign(ui, { q: '', status: '', folder: '', source: '', goal: '', horizon: '' }); rerender(); });
  $('[data-act="add"]', view).addEventListener('click', () => openLeadForm(null, ui.folder && ui.folder !== 'none' ? { folderId: ui.folder } : {}));
  $('[data-act="csv"]', view).addEventListener('click', () => exportCSV(list));
  $$('tbody tr', view).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('.chk')) location.hash = '#/lead/' + tr.dataset.id; }));
  $$('[data-sel]', view).forEach((c) => c.addEventListener('change', () => { c.checked ? ui.sel.add(c.dataset.sel) : ui.sel.delete(c.dataset.sel); rerender(); }));
  $('#selAll', view)?.addEventListener('change', (e) => { ui.sel = e.target.checked ? new Set(list.map((l) => l.id)) : new Set(); rerender(); });

  const chosen = () => state.leads.filter((l) => ui.sel.has(l.id));
  $$('[data-bulk]', view).forEach((s) => s.addEventListener('change', () => {
    if (!s.value) return;
    chosen().forEach((l) => {
      if (s.dataset.bulk === 'status') updateLead(l, { status: s.value });
      else updateLead(l, { folderId: s.value === '__none' ? '' : s.value });
    });
    toast(`עודכנו ${ui.sel.size} לידים`);
  }));
  $$('[data-bulk-act]', view).forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.bulkAct, ls = chosen();
    if (act === 'email') openComposer({ leads: ls.filter((l) => l.email) });
    if (act === 'csv') exportCSV(ls, 'leads-selected');
    if (act === 'archive') { ls.forEach((l) => (l.archived = !ui.archived)); ui.sel.clear(); save(); toast(ui.archived ? 'הלידים שוחזרו' : 'הלידים הועברו לארכיון'); }
    if (act === 'delete' && (await confirmDialog(`למחוק ${ls.length} לידים לצמיתות?`, { okText: 'מחיקה', danger: true }))) { deleteLeads(ls.map((l) => l.id)); ui.sel.clear(); toast('הלידים נמחקו'); }
  }));
}

/* ---------- Kanban pipeline ---------- */
export function renderPipeline(view) {
  const leads = state.leads.filter((l) => !l.archived);
  const cols = [...PIPELINE, STATUSES.find((s) => s.id === 'lost')];
  view.innerHTML = `
    <div class="page-head"><div><h1>צנרת מכירות</h1><div class="sub">גררו כרטיס בין העמודות כדי לעדכן סטטוס</div></div><span class="spacer"></span>
      <button class="btn primary" data-act="add">${icon('plus')}ליד חדש</button></div>
    <div class="kanban">${cols.map((s) => {
      const ls = leads.filter((l) => l.status === s.id).sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
      return `<div class="kcol"><div class="kcol-head"><span class="status-dot" style="background:${s.color}"></span><span class="t">${esc(s.label)}</span><span class="c">${ls.length}</span><span class="sum num">${fmtMoneyShort(sum(ls, (l) => l.amount))}</span></div>
        <div class="kcol-body" data-status="${s.id}">${ls.map((l) => `
          <div class="kcard" draggable="true" data-id="${l.id}" style="--c:${s.color}">
            <div class="row"><span class="nm grow ellipsis">${esc(fullName(l))}</span>${l.priority === 'high' ? `<span class="prio high">${icon('flag')}</span>` : ''}</div>
            <div class="meta">${l.city ? `<span>${esc(l.city)}</span>` : ''}${l.goal ? `<span>${esc(l.goal)}</span>` : ''}</div>
            <div class="row"><span class="amt num grow">${l.amount ? fmtMoneyShort(l.amount) : '—'}</span>${l.nextFollowUp ? dueBadge(l.nextFollowUp) : ''}</div>
          </div>`).join('') || '<div class="muted small" style="text-align:center;padding:16px">גררו לכאן</div>'}</div></div>`;
    }).join('')}</div>`;
  $('[data-act="add"]', view).addEventListener('click', () => openLeadForm());
  let dragId = null;
  $$('.kcard', view).forEach((c) => {
    c.addEventListener('dragstart', (e) => { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
    c.addEventListener('dragend', () => c.classList.remove('dragging'));
    c.addEventListener('click', () => (location.hash = '#/lead/' + c.dataset.id));
  });
  $$('.kcol-body', view).forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('over');
      const l = getLead(dragId || e.dataTransfer.getData('text/plain'));
      if (l && l.status !== col.dataset.status) {
        updateLead(l, { status: col.dataset.status });
        toast(`${fullName(l)} ← ${statusById(col.dataset.status).label}`);
      }
    });
  });
}
