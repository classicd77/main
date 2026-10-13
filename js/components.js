// Reusable UI pieces: badges, the lead form modal and the email composer.
import {
  state, STATUSES, HORIZONS, GOALS, SOURCES, PRIORITIES, statusById, fullName,
  createLead, updateLead, findDuplicate, renderTemplate, TEMPLATE_VARS, files, FILE_CATEGORIES,
} from './store.js';
import { esc, icon, openModal, toast, fmtSize, readAsDataURL, downloadBlob, $, $$ } from './util.js';
import { sendEmail, scriptReady } from './mailer.js';

export const statusBadge = (id) => {
  const s = statusById(id);
  return `<span class="badge"><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`;
};
export const prioBadge = (p) => {
  const x = PRIORITIES.find((q) => q.id === p) || PRIORITIES[1];
  return `<span class="prio ${x.id}">${icon('flag')}${esc(x.label)}</span>`;
};
export const folderOf = (id) => state.folders.find((f) => f.id === id);
export const folderBadge = (id) => {
  const f = folderOf(id);
  return f ? `<span class="badge"><span class="sw" style="background:${f.color};border-radius:3px"></span>${esc(f.name)}</span>` : '<span class="muted small">ללא תיק</span>';
};
const opts = (list, val, empty = '— בחירה —') =>
  `<option value="">${empty}</option>` + list.map((o) => {
    const v = typeof o === 'string' ? o : o.id;
    const l = typeof o === 'string' ? o : o.label ?? o.name;
    return `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');
// keep a value that's not in the preset list (e.g. parsed from email)
const optsKeep = (list, val) => opts(val && !list.includes(val) ? [...list, val] : list, val);

/** Field markup shared by the lead form modal and the inbox import screen. */
export function leadFieldsHTML(l) {
  return `
  <div class="section-title">פרטים אישיים</div>
  <div class="form-grid">
    <div class="field"><label>שם פרטי *</label><input class="input" name="firstName" value="${esc(l.firstName)}" required></div>
    <div class="field"><label>שם משפחה</label><input class="input" name="lastName" value="${esc(l.lastName)}"></div>
    <div class="field"><label>טלפון נייד</label><input class="input ltr" name="phone" type="tel" value="${esc(l.phone)}" style="text-align:right"></div>
    <div class="field"><label>אימייל</label><input class="input ltr" name="email" type="email" value="${esc(l.email)}" style="text-align:right"></div>
    <div class="field"><label>עיר מגורים</label><input class="input" name="city" value="${esc(l.city)}" list="dl-cities"></div>
    <div class="field"><label>גיל</label><input class="input" name="age" type="number" min="0" max="120" value="${esc(l.age)}"></div>
    <div class="field"><label>מקצוע</label><input class="input" name="profession" value="${esc(l.profession)}"></div>
  </div>
  <div class="section-title">פרופיל השקעה</div>
  <div class="form-grid">
    <div class="field"><label>טווח השקעה</label><select class="input" name="horizon">${optsKeep(HORIZONS, l.horizon)}</select></div>
    <div class="field"><label>מטרת ההשקעה</label><select class="input" name="goal">${optsKeep(GOALS, l.goal)}</select></div>
    <div class="field"><label>סכום השקעה</label><div class="input-affix"><input class="input" name="amount" type="number" min="0" step="1000" value="${esc(l.amount)}"><span class="affix">₪</span></div></div>
    <div class="field"><label>דמי ניהול מוצעים</label><div class="input-affix"><input class="input" name="fee" type="number" min="0" max="10" step="0.05" value="${esc(l.fee)}"><span class="affix">%</span></div></div>
  </div>
  <div class="section-title">ניהול וסיווג</div>
  <div class="form-grid">
    <div class="field"><label>סטטוס</label><select class="input" name="status">${opts(STATUSES, l.status, '')}</select></div>
    <div class="field"><label>עדיפות</label><select class="input" name="priority">${opts(PRIORITIES, l.priority, '')}</select></div>
    <div class="field"><label>מקור</label><select class="input" name="source">${optsKeep(SOURCES, l.source)}</select></div>
    <div class="field"><label>תיק</label><select class="input" name="folderId">${opts(state.folders, l.folderId, 'ללא תיק')}</select></div>
    <div class="field"><label>מעקב הבא</label><input class="input" name="nextFollowUp" type="date" value="${esc(l.nextFollowUp)}"></div>
    <div class="field"><label>תגיות (מופרדות בפסיק)</label><input class="input" name="tags" value="${esc((l.tags || []).join(', '))}"></div>
  </div>
  <div class="section-title">פירוט השיחה</div>
  <div class="field"><textarea class="input" name="conversation" rows="5" placeholder="סיכום השיחה, צרכים, התנגדויות, נקודות חשובות…">${esc(l.conversation)}</textarea></div>
  <datalist id="dl-cities">${[...new Set(state.leads.map((x) => x.city).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
}

export function readLeadFields(root) {
  const g = (n) => root.querySelector(`[name="${n}"]`)?.value.trim() ?? '';
  return {
    firstName: g('firstName'), lastName: g('lastName'), phone: g('phone'), email: g('email'), city: g('city'),
    age: g('age') ? Number(g('age')) : '', profession: g('profession'), horizon: g('horizon'), goal: g('goal'),
    amount: g('amount') ? Number(g('amount')) : '', fee: g('fee') !== '' ? Number(g('fee')) : '',
    status: g('status') || 'new', priority: g('priority') || 'med', source: g('source') || 'ידני', folderId: g('folderId'),
    nextFollowUp: g('nextFollowUp'), tags: g('tags').split(/[,،]/).map((t) => t.trim()).filter(Boolean), conversation: g('conversation'),
  };
}

/** Add / edit lead modal. Resolves to the saved lead (or null). */
export function openLeadForm(lead, prefill = {}, { source = 'ידני', onSaved } = {}) {
  const isNew = !lead;
  const l = { status: 'new', priority: 'med', source, fee: state.settings.defaultFee, tags: [], ...(lead || {}), ...prefill };
  const { el, close } = openModal({
    title: isNew ? 'ליד חדש' : 'עריכת ליד – ' + esc(fullName(l)),
    size: 'wide',
    body: `<form id="leadForm" novalidate>${leadFieldsHTML(l)}</form><div id="dupWarn"></div>`,
    foot: `<button class="btn" data-close>ביטול</button><button class="btn primary" data-save>${icon('check')}${isNew ? 'יצירת ליד' : 'שמירה'}</button>`,
  });
  const form = $('#leadForm', el);
  const checkDup = () => {
    const d = findDuplicate({ email: form.email.value, phone: form.phone.value });
    $('#dupWarn', el).innerHTML = d && d.id !== l.id
      ? `<div class="callout" style="margin-top:14px">${icon('alert')}<div>קיים כבר ליד עם פרטים דומים: <a href="#/lead/${d.id}" data-close><b>${esc(fullName(d))}</b></a></div></div>`
      : '';
    $$('[data-close]', $('#dupWarn', el)).forEach((a) => a.addEventListener('click', close));
  };
  form.email.addEventListener('change', checkDup);
  form.phone.addEventListener('change', checkDup);
  checkDup();
  $('[data-save]', el).addEventListener('click', () => {
    const data = readLeadFields(form);
    if (!data.firstName && !data.lastName) { form.firstName.focus(); return toast('יש להזין שם', 'err'); }
    let saved;
    if (isNew) saved = createLead(data, { source: data.source });
    else { updateLead(lead, data); saved = lead; }
    toast(isNew ? 'הליד נוצר בהצלחה' : 'השינויים נשמרו');
    close();
    onSaved ? onSaved(saved) : isNew && (location.hash = '#/lead/' + saved.id);
  });
}

/** Email composer. leads: array of recipients; fileIds: preselected marketing files. */
export async function openComposer({ leads = [], to = '', templateId = '', fileIds = [] } = {}) {
  const allFiles = await files.all();
  const st = state.settings;
  const multi = leads.length > 1;
  const recipients = leads.length ? leads.map((l) => l.email).filter(Boolean).join(', ') : to;
  const tpl = state.templates.find((t) => t.id === templateId);
  const first = leads[0];
  const { el, close } = openModal({
    title: multi ? `שליחת מייל ל-${leads.length} לידים` : 'שליחת מייל',
    size: 'wide',
    body: `
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        <div class="field span-all"><label>אל</label><input class="input ltr" id="cTo" value="${esc(recipients)}" style="text-align:right" ${multi ? 'readonly' : ''}></div>
        <div class="field"><label>תבנית</label><select class="input" id="cTpl"><option value="">ללא תבנית</option>${state.templates.map((t) => `<option value="${t.id}" ${t.id === templateId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
        <div class="field"><label>אופן שליחה</label><select class="input" id="cMode">
          <option value="mailto" ${st.sendMode === 'mailto' ? 'selected' : ''}>תוכנת הדואר במחשב</option>
          <option value="gmail" ${st.sendMode === 'gmail' ? 'selected' : ''}>חלון כתיבה ב-Gmail</option>
          <option value="script" ${st.sendMode === 'script' ? 'selected' : ''} ${scriptReady() ? '' : 'disabled'}>שליחה ישירה (גשר Gmail)${scriptReady() ? '' : ' – לא מוגדר'}</option>
        </select></div>
        <div class="field span-all"><label>נושא</label><input class="input" id="cSubj" value="${esc(tpl ? renderTemplate(tpl.subject, first) : '')}"></div>
        <div class="field span-all"><label>תוכן ${multi ? '<span class="muted">(משתני התבנית יותאמו לכל נמען)</span>' : ''}</label><textarea class="input" id="cBody" rows="11">${esc(tpl ? (multi ? tpl.body : renderTemplate(tpl.body, first)) : '')}</textarea>
          <div class="row wrap small muted">הוספת משתנה: ${TEMPLATE_VARS.map((v) => `<button type="button" class="chip" data-var="${esc(v)}" style="padding:2px 8px;font-size:11px">${esc(v)}</button>`).join('')}</div></div>
        <div class="field span-all"><label>קבצים מצורפים מהספרייה השיווקית</label>
          ${allFiles.length ? `<div class="chips" id="cFiles">${allFiles.map((f) => `<label class="chip ${fileIds.includes(f.id) ? 'on' : ''}"><input type="checkbox" value="${f.id}" ${fileIds.includes(f.id) ? 'checked' : ''} hidden>${icon('file')} ${esc(f.name)} <span class="c">${fmtSize(f.size)}</span></label>`).join('')}</div>
          <div class="small muted" id="cAttNote"></div>` : '<div class="small muted">אין קבצים בספרייה. ניתן להעלות בעמוד "קבצים שיווקיים".</div>'}
        </div>
      </div>`,
    foot: `<button class="btn" data-close>ביטול</button><button class="btn primary" id="cSend">${icon('send')}שליחה</button>`,
  });
  const body = $('#cBody', el), subj = $('#cSubj', el), mode = $('#cMode', el);
  let lastFocus = body;
  [body, subj].forEach((f) => f.addEventListener('focus', () => (lastFocus = f)));
  $$('[data-var]', el).forEach((b) => b.addEventListener('click', () => {
    const t = lastFocus, ins = `{{${b.dataset.var}}}`;
    const s = t.selectionStart ?? t.value.length;
    t.value = t.value.slice(0, s) + ins + t.value.slice(t.selectionEnd ?? s);
    t.focus(); t.selectionStart = t.selectionEnd = s + ins.length;
  }));
  $('#cTpl', el).addEventListener('change', (e) => {
    const t = state.templates.find((x) => x.id === e.target.value);
    if (!t) return;
    subj.value = multi ? t.subject : renderTemplate(t.subject, first);
    body.value = multi ? t.body : renderTemplate(t.body, first);
  });
  const attNote = () => {
    const n = $('#cAttNote', el);
    if (!n) return;
    const any = $$('#cFiles input:checked', el).length;
    n.textContent = any && mode.value !== 'script' ? 'שימו לב: צירוף קבצים אוטומטי זמין רק בשליחה ישירה. בשיטות האחרות הקבצים יורדו למחשב כדי שתצרפו אותם ידנית.' : '';
  };
  $$('#cFiles input', el).forEach((c) => c.addEventListener('change', () => { c.parentElement.classList.toggle('on', c.checked); attNote(); }));
  mode.addEventListener('change', attNote);
  attNote();

  $('#cSend', el).addEventListener('click', async () => {
    const btn = $('#cSend', el);
    const toVal = $('#cTo', el).value.trim();
    if (!toVal) return toast('יש להזין נמען', 'err');
    if (!subj.value.trim()) return toast('יש להזין נושא', 'err');
    const chosen = $$('#cFiles input:checked', el).map((c) => allFiles.find((f) => f.id === c.value));
    btn.disabled = true;
    try {
      let attachments = [];
      if (chosen.length && mode.value === 'script') {
        attachments = await Promise.all(chosen.map(async (f) => ({ name: f.name, type: f.type || 'application/octet-stream', data: (await readAsDataURL(f.blob)).split(',')[1] })));
      } else if (chosen.length) {
        chosen.forEach((f) => downloadBlob(f.blob, f.name));
      }
      if (multi && mode.value === 'script') {
        for (const l of leads.filter((x) => x.email)) {
          await sendEmail({ to: l.email, subject: renderTemplate(subj.value, l), body: renderTemplate(body.value, l), attachments, leads: [l], mode: 'script' });
        }
      } else {
        await sendEmail({ to: toVal, subject: multi ? subj.value : renderTemplate(subj.value, first), body: multi ? renderTemplate(body.value, null) : renderTemplate(body.value, first), attachments, leads, mode: mode.value });
      }
      toast(mode.value === 'script' ? 'המייל נשלח' : 'המייל הועבר לתוכנת הדואר ונרשם ביומן');
      close();
    } catch (e) {
      toast(e.message || 'שליחה נכשלה', 'err');
      btn.disabled = false;
    }
  });
}

export function fileExt(name) {
  return (String(name).split('.').pop() || '').slice(0, 4).toUpperCase();
}
export function fileColor(name) {
  const e = fileExt(name);
  if (['PDF'].includes(e)) return 'linear-gradient(135deg,#e34948,#b42828)';
  if (['PPT', 'PPTX', 'KEY'].includes(e)) return 'linear-gradient(135deg,#eb6834,#c4501f)';
  if (['DOC', 'DOCX'].includes(e)) return 'linear-gradient(135deg,#2a78d6,#1c5cab)';
  if (['XLS', 'XLSX', 'CSV'].includes(e)) return 'linear-gradient(135deg,#1baf7a,#0f7a54)';
  if (['MP4', 'MOV'].includes(e)) return 'linear-gradient(135deg,#6250d6,#3e2fa0)';
  return 'linear-gradient(135deg,#c9a24a,#8c6c1f)';
}
export { FILE_CATEGORIES };
