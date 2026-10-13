import { state, save, STATUSES, TEMPLATE_VARS, getLead, fullName } from '../store.js';
import { esc, icon, fmtDateTime, timeAgo, openModal, confirmDialog, toast, uid, $, $$ } from '../util.js';
import { openComposer } from '../components.js';

const MODES = { mailto: 'תוכנת דואר', gmail: 'Gmail', script: 'שליחה ישירה' };

export function render(view) {
  const log = state.emails;
  view.innerHTML = `
    <div class="page-head"><div><h1>מיילים</h1><div class="sub">שליחה ללידים, תבניות ויומן מיילים</div></div><span class="spacer"></span>
      <button class="btn" data-act="group">${icon('users')}מייל קבוצתי</button>
      <button class="btn primary" data-act="new">${icon('send')}מייל חדש</button></div>
    <div class="grid cols-3">
      <div class="card span-2">
        <div class="card-head"><h3>יומן מיילים</h3><span class="spacer"></span><span class="sub">${log.length} מיילים</span></div>
        ${log.length ? `<div class="list scroll-y" style="max-height:640px">${log.map((e) => {
          const leads = (e.leadIds || []).map(getLead).filter(Boolean);
          return `<details class="list-item" style="display:block">
            <summary class="row" style="cursor:pointer"><span class="k-ic" style="color:var(--accent)">${icon('mail')}</span>
              <span class="grow" style="min-width:0"><div class="ellipsis"><b>${esc(e.subject)}</b></div><div class="small muted ellipsis">אל: ${leads.length ? leads.map((l) => esc(fullName(l))).join(', ') : esc(e.to)}</div></span>
              <span class="badge">${MODES[e.mode] || ''}</span><span class="small muted" title="${fmtDateTime(e.at)}">${timeAgo(e.at)}</span></summary>
            <div class="email-preview" style="margin-top:8px">${esc(e.body)}</div>
            ${e.attachments?.length ? `<div class="small muted" style="margin-top:6px">${icon('file')} ${e.attachments.map(esc).join(', ')}</div>` : ''}
          </details>`;
        }).join('')}</div>` : `<div class="empty"><div class="big">${icon('send')}</div><h3>עדיין לא נשלחו מיילים</h3><div>מיילים שנשלחים מכרטיסי הלידים יירשמו כאן</div></div>`}
      </div>
      <div class="card">
        <div class="card-head"><h3>תבניות</h3><span class="spacer"></span><button class="btn sm" data-act="tpl">${icon('plus')}תבנית</button></div>
        <div class="grid" style="gap:10px">${state.templates.map((t) => `
          <div class="tpl-item"><span class="k-ic" style="color:var(--accent)">${icon('note')}</span><div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${esc(t.name)}</b><div class="small muted ellipsis">${esc(t.subject)}</div></div>
            <button class="icon-btn sm" data-edit="${t.id}" title="עריכה">${icon('edit')}</button><button class="icon-btn sm danger" data-del="${t.id}" title="מחיקה">${icon('trash')}</button></div>`).join('') || '<div class="muted small">אין תבניות</div>'}</div>
        <div class="small muted" style="margin-top:14px">ניתן להשתמש במשתנים כמו <code>{{שם פרטי}}</code> ו-<code>{{סכום}}</code> שיוחלפו בפרטי הליד.</div>
      </div>
    </div>`;
  $('[data-act="new"]', view).addEventListener('click', () => openComposer());
  $('[data-act="group"]', view).addEventListener('click', groupMail);
  $('[data-act="tpl"]', view).addEventListener('click', () => editTemplate());
  $$('[data-edit]', view).forEach((b) => b.addEventListener('click', () => editTemplate(state.templates.find((t) => t.id === b.dataset.edit))));
  $$('[data-del]', view).forEach((b) => b.addEventListener('click', async () => {
    if (await confirmDialog('למחוק את התבנית?', { okText: 'מחיקה', danger: true })) { state.templates = state.templates.filter((t) => t.id !== b.dataset.del); save(); }
  }));
}

export function editTemplate(t) {
  const isNew = !t;
  t = t || { id: uid(), name: '', subject: '', body: '' };
  const { el, close } = openModal({
    title: isNew ? 'תבנית חדשה' : 'עריכת תבנית',
    body: `<div class="grid" style="gap:14px">
      <div class="field"><label>שם התבנית</label><input class="input" id="tN" value="${esc(t.name)}"></div>
      <div class="field"><label>נושא</label><input class="input" id="tS" value="${esc(t.subject)}"></div>
      <div class="field"><label>תוכן</label><textarea class="input" id="tB" rows="10">${esc(t.body)}</textarea></div>
      <div class="row wrap small muted">משתנים: ${TEMPLATE_VARS.map((v) => `<button type="button" class="chip" data-var="${esc(v)}" style="padding:2px 8px;font-size:11px">${esc(v)}</button>`).join('')}</div></div>`,
    foot: `<button class="btn" data-close>ביטול</button><button class="btn primary" data-ok>שמירה</button>`,
  });
  let last = $('#tB', el);
  ['#tS', '#tB'].forEach((s) => $(s, el).addEventListener('focus', (e) => (last = e.target)));
  $$('[data-var]', el).forEach((b) => b.addEventListener('click', () => {
    const ins = `{{${b.dataset.var}}}`, s = last.selectionStart ?? last.value.length;
    last.value = last.value.slice(0, s) + ins + last.value.slice(last.selectionEnd ?? s);
    last.focus();
  }));
  $('[data-ok]', el).addEventListener('click', () => {
    Object.assign(t, { name: $('#tN', el).value.trim() || 'תבנית', subject: $('#tS', el).value, body: $('#tB', el).value });
    if (isNew) state.templates.push(t);
    close();
    save();
    toast('התבנית נשמרה');
  });
}

function groupMail() {
  const { el, close } = openModal({
    title: 'מייל קבוצתי',
    size: 'narrow',
    body: `<div class="grid" style="gap:14px">
      <div class="field"><label>סטטוס</label><select class="input" id="gS"><option value="">כל הסטטוסים</option>${STATUSES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></div>
      <div class="field"><label>תיק</label><select class="input" id="gF"><option value="">כל התיקים</option>${state.folders.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></div>
      <div class="callout info" id="gC"></div></div>`,
    foot: `<button class="btn" data-close>ביטול</button><button class="btn primary" data-ok>המשך לכתיבה</button>`,
  });
  const pick = () => state.leads.filter((l) => !l.archived && l.email && (!$('#gS', el).value || l.status === $('#gS', el).value) && (!$('#gF', el).value || l.folderId === $('#gF', el).value));
  const upd = () => ($('#gC', el).innerHTML = `${icon('users')}<span><b>${pick().length}</b> לידים עם כתובת מייל תואמים לסינון</span>`);
  ['#gS', '#gF'].forEach((s) => $(s, el).addEventListener('change', upd));
  upd();
  $('[data-ok]', el).addEventListener('click', () => {
    const leads = pick();
    if (!leads.length) return toast('אין נמענים', 'err');
    close();
    openComposer({ leads });
  });
}
