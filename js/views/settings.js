import { state, save, replaceState, resetState, seedDemo, clearDemo, FOLDER_COLORS, files } from '../store.js';
import { esc, icon, toast, confirmDialog, downloadBlob, readAsText, readAsDataURL, uid, $, $$ } from '../util.js';
import { APPS_SCRIPT, scriptReady } from '../mailer.js';

let tab = 'profile';
const TABS = [['profile', 'user', 'פרופיל'], ['email', 'mail', 'מייל וקליטת לידים'], ['folders', 'folder', 'תיקים'], ['data', 'database', 'נתונים וגיבוי']];

export function render(view, params) {
  if (params.get('tab')) { tab = params.get('tab'); history.replaceState(null, '', '#/settings'); }
  const st = state.settings;
  view.innerHTML = `
    <div class="page-head"><div><h1>הגדרות</h1><div class="sub">התאמת המערכת לעבודה שלכם</div></div></div>
    <div class="settings-layout">
      <nav class="settings-nav">${TABS.map(([id, ic, l]) => `<button class="${tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}${l}</button>`).join('')}</nav>
      <div>${{ profile, email, folders, data }[tab](st)}</div>
    </div>`;
  $$('[data-tab]', view).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(view, new URLSearchParams()); }));
  // generic bound fields: data-s="key" (numbers via data-num)
  $$('[data-s]', view).forEach((inp) => inp.addEventListener('change', () => {
    const v = inp.type === 'checkbox' ? inp.checked : inp.dataset.num != null ? Number(inp.value) || 0 : inp.value.trim();
    st[inp.dataset.s] = v;
    if (inp.dataset.s === 'leadSourceEmail' || inp.dataset.s === 'leadSubjectFilter') st.lastSync = 0;
    save();
    toast('נשמר');
  }));
  ({ profile: () => {}, email: bindEmail, folders: bindFolders, data: bindData })[tab](view);
}

const field = (label, key, val, { type = 'text', hint = '', num = false, ltr = false, ph = '' } = {}) =>
  `<div class="field"><label>${label}</label><input class="input ${ltr ? 'ltr' : ''}" ${ltr ? 'style="text-align:right"' : ''} type="${type}" data-s="${key}" ${num ? 'data-num step="0.05"' : ''} value="${esc(val)}" placeholder="${esc(ph)}">${hint ? `<div class="small muted">${hint}</div>` : ''}</div>`;

function profile(st) {
  return `<div class="card"><div class="card-head"><h3>פרטי היועץ והחברה</h3></div>
    <p class="small muted" style="margin-top:0">פרטים אלו משמשים בחתימת המיילים ובתבניות (‎{{יועץ}}‎, ‎{{חברה}}‎, ‎{{טלפון יועץ}}‎).</p>
    <div class="form-grid">
      ${field('שם היועץ', 'advisorName', st.advisorName)}
      ${field('שם החברה', 'company', st.company)}
      ${field('טלפון', 'advisorPhone', st.advisorPhone, { type: 'tel', ltr: true })}
    </div>
    <div class="section-title">ברירות מחדל</div>
    <div class="form-grid">
      ${field('דמי ניהול ברירת מחדל (%)', 'defaultFee', st.defaultFee, { type: 'number', num: true })}
      ${field('ימים עד מעקב הבא אחרי "בוצע"', 'followUpDays', st.followUpDays, { type: 'number', num: true })}
    </div></div>`;
}

function email(st) {
  return `
  <div class="card" style="margin-bottom:18px"><div class="card-head"><h3>${icon('inbox')} מקור הלידים</h3></div>
    <div class="form-grid">
      ${field('כתובת המייל שממנה מגיעים הלידים', 'leadSourceEmail', st.leadSourceEmail, { type: 'email', ltr: true, ph: 'leads@my-site.co.il', hint: 'לדוגמה: כתובת טופס האתר, מערכת הדיוור או פלטפורמת הפרסום' })}
      ${field('סינון לפי נושא (רשות)', 'leadSubjectFilter', st.leadSubjectFilter, { ph: 'ליד חדש', hint: 'ייקלטו רק מיילים שהנושא שלהם מכיל טקסט זה' })}
    </div></div>
  <div class="card" style="margin-bottom:18px"><div class="card-head"><h3>${icon('link')} גשר Gmail – קליטה ושליחה אוטומטית</h3><span class="spacer"></span>${scriptReady() ? '<span class="badge"><span class="sw" style="background:var(--s6)"></span>מוגדר</span>' : '<span class="badge"><span class="sw" style="background:var(--muted)"></span>לא מוגדר</span>'}</div>
    <p class="small ink2" style="margin-top:0">הגשר הוא סקריפט קטן וחינמי שרץ בחשבון הגוגל שלכם. הוא מאפשר ל-CRM למשוך מיילים חדשים מהכתובת שהוגדרה ולשלוח מיילים (כולל קבצים מצורפים) ישירות מה-Gmail שלכם. הנתונים לא עוברים דרך שום שרת אחר.</p>
    <ol class="small ink2" style="padding-inline-start:20px;line-height:1.9">
      <li>היכנסו ל-<a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> ופתחו פרויקט חדש.</li>
      <li>העתיקו את הקוד למטה, הדביקו אותו במקום הקיים, ושנו את <code>TOKEN</code> לסיסמה ארוכה משלכם.</li>
      <li>לחצו <b>Deploy ← New deployment</b>, בחרו <b>Web app</b>, הגדירו <b>Execute as: Me</b> ו-<b>Who has access: Anyone</b>, ואשרו את ההרשאות.</li>
      <li>הדביקו כאן את כתובת ה-Web app ואת הסיסמה שבחרתם.</li>
    </ol>
    <div class="row" style="margin-bottom:6px"><b class="small">קוד הסקריפט</b><span class="spacer"></span><button class="btn sm" data-act="copy">${icon('copy')}העתקה</button></div>
    <pre class="code" id="scriptCode">${esc(APPS_SCRIPT)}</pre>
    <div class="form-grid" style="margin-top:14px">
      ${field('כתובת ה-Web app', 'scriptUrl', st.scriptUrl, { type: 'url', ltr: true, ph: 'https://script.google.com/macros/s/…/exec' })}
      ${field('סיסמה (TOKEN)', 'scriptToken', st.scriptToken, { type: 'password', ltr: true })}
      <div class="field"><label>סנכרון אוטומטי</label><select class="input" data-s="autoSyncMin" data-num>${[[0, 'כבוי'], [5, 'כל 5 דקות'], [15, 'כל 15 דקות'], [30, 'כל 30 דקות'], [60, 'כל שעה']].map(([v, l]) => `<option value="${v}" ${Number(st.autoSyncMin) === v ? 'selected' : ''}>${l}</option>`).join('')}</select><div class="small muted">פועל כשהמערכת פתוחה בדפדפן</div></div>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn" data-act="test" ${scriptReady() && st.leadSourceEmail ? '' : 'disabled'}>${icon('refresh')}בדיקת חיבור</button><span class="small muted" id="testRes"></span></div>
  </div>
  <div class="card"><div class="card-head"><h3>${icon('send')} שליחת מיילים</h3></div>
    <div class="field" style="max-width:420px"><label>אופן שליחה ברירת מחדל</label><select class="input" data-s="sendMode">
      <option value="mailto" ${st.sendMode === 'mailto' ? 'selected' : ''}>פתיחה בתוכנת הדואר במחשב (Outlook / Mail)</option>
      <option value="gmail" ${st.sendMode === 'gmail' ? 'selected' : ''}>פתיחת חלון כתיבה ב-Gmail</option>
      <option value="script" ${st.sendMode === 'script' ? 'selected' : ''} ${scriptReady() ? '' : 'disabled'}>שליחה ישירה דרך גשר ה-Gmail (כולל קבצים מצורפים)</option>
    </select></div>
  </div>`;
}
function bindEmail(view) {
  $('[data-act="copy"]', view).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(APPS_SCRIPT); toast('הקוד הועתק'); } catch (e) { toast('ההעתקה נכשלה – סמנו והעתיקו ידנית', 'err'); }
  });
  $('[data-act="test"]', view).addEventListener('click', async () => {
    const st = state.settings, res = $('#testRes', view);
    res.textContent = 'בודק…';
    try {
      const u = new URL(st.scriptUrl);
      u.searchParams.set('token', st.scriptToken);
      u.searchParams.set('from', st.leadSourceEmail);
      const r = await fetch(u.toString());
      const d = await r.json();
      if (d.error) throw new Error(d.error === 'unauthorized' ? 'סיסמה שגויה' : d.error);
      res.innerHTML = `<span style="color:var(--good)">✓ החיבור תקין · נמצאו ${d.messages.length} מיילים מ-30 הימים האחרונים</span>`;
    } catch (e) {
      res.innerHTML = `<span style="color:var(--bad)">✗ ${esc(e.message || 'החיבור נכשל')}</span>`;
    }
  });
}

function folders() {
  return `<div class="card"><div class="card-head"><h3>תיקים לתיוק לידים</h3><span class="spacer"></span><button class="btn sm primary" data-act="addF">${icon('plus')}תיק חדש</button></div>
    <div class="grid" style="gap:10px">${state.folders.map((f) => `
      <div class="tpl-item">
        <span class="status-dot" style="background:${f.color};border-radius:4px;width:14px;height:14px"></span>
        <input class="input sm" data-fname="${f.id}" value="${esc(f.name)}" style="max-width:260px">
        <div class="swatches">${FOLDER_COLORS.map((c) => `<button style="background:${c}" class="${c === f.color ? 'on' : ''}" data-fcolor="${f.id}" data-c="${c}" title="${c}"></button>`).join('')}</div>
        <span class="spacer"></span><span class="small muted">${state.leads.filter((l) => l.folderId === f.id).length} לידים</span>
        <button class="icon-btn sm danger" data-fdel="${f.id}" title="מחיקה">${icon('trash')}</button>
      </div>`).join('') || '<div class="muted">אין תיקים</div>'}</div></div>`;
}
function bindFolders(view) {
  $('[data-act="addF"]', view).addEventListener('click', () => { state.folders.push({ id: uid(), name: 'תיק חדש', color: FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length] }); save(); });
  $$('[data-fname]', view).forEach((i) => i.addEventListener('change', () => { state.folders.find((f) => f.id === i.dataset.fname).name = i.value.trim() || 'תיק'; save(); }));
  $$('[data-fcolor]', view).forEach((b) => b.addEventListener('click', () => { state.folders.find((f) => f.id === b.dataset.fcolor).color = b.dataset.c; save(); }));
  $$('[data-fdel]', view).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDialog('למחוק את התיק? הלידים שבו לא יימחקו.', { okText: 'מחיקה', danger: true }))) return;
    state.folders = state.folders.filter((f) => f.id !== b.dataset.fdel);
    state.leads.forEach((l) => { if (l.folderId === b.dataset.fdel) l.folderId = ''; });
    save();
  }));
}

function data() {
  const demoN = state.leads.filter((l) => l.demo).length;
  return `
  <div class="card" style="margin-bottom:18px"><div class="card-head"><h3>${icon('download')} גיבוי ושחזור</h3></div>
    <p class="small ink2" style="margin-top:0">כל הנתונים נשמרים מקומית בדפדפן הזה. מומלץ להוריד גיבוי באופן קבוע, ולהשתמש בו גם כדי להעביר את המערכת למחשב אחר.</p>
    <div class="row wrap">
      <button class="btn primary" data-act="backup">${icon('download')}הורדת גיבוי מלא</button>
      <label class="btn">${icon('upload')}שחזור מגיבוי<input type="file" id="restore" accept=".json,application/json" hidden></label>
      <label class="check small"><input type="checkbox" id="withFiles" checked>כולל קבצים שיווקיים</label>
    </div></div>
  <div class="card" style="margin-bottom:18px"><div class="card-head"><h3>${icon('sparkle')} נתוני הדגמה</h3></div>
    <p class="small ink2" style="margin-top:0">טעינת כ-46 לידים לדוגמה כדי לראות את הדשבורד והדוחות בפעולה. ניתן להסיר אותם בכל עת בלי לפגוע בנתונים אמיתיים.</p>
    <div class="row wrap"><button class="btn" data-act="seed">${icon('database')}טעינת נתוני הדגמה</button>${demoN ? `<button class="btn danger" data-act="unseed">${icon('trash')}הסרת ${demoN} לידי הדגמה</button>` : ''}</div></div>
  <div class="card"><div class="card-head"><h3 style="color:var(--bad)">${icon('alert')} איפוס</h3></div>
    <p class="small ink2" style="margin-top:0">מחיקת כל הלידים, ההגדרות והקבצים. פעולה זו אינה הפיכה.</p>
    <button class="btn danger" data-act="reset">${icon('trash')}איפוס מלא של המערכת</button></div>`;
}
function bindData(view) {
  $('[data-act="backup"]', view).addEventListener('click', async () => {
    const out = { app: 'leadflow-crm', exportedAt: new Date().toISOString(), state };
    if ($('#withFiles', view).checked) {
      out.files = await Promise.all((await files.all()).map(async (f) => ({ ...f, blob: undefined, data: await readAsDataURL(f.blob) })));
    }
    downloadBlob(new Blob([JSON.stringify(out)], { type: 'application/json' }), `leadflow-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast('הגיבוי ירד למחשב');
  });
  $('#restore', view).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const d = JSON.parse(await readAsText(f));
      if (d.app !== 'leadflow-crm' || !d.state) throw new Error();
      if (!(await confirmDialog('השחזור יחליף את כל הנתונים הנוכחיים. להמשיך?', { okText: 'שחזור', danger: true }))) return;
      if (Array.isArray(d.files)) {
        for (const x of d.files) {
          const blob = await (await fetch(x.data)).blob();
          await files.put({ ...x, data: undefined, blob });
        }
      }
      replaceState(d.state);
      toast('הנתונים שוחזרו');
    } catch (err) {
      toast('קובץ גיבוי לא תקין', 'err');
    }
  });
  $('[data-act="seed"]', view).addEventListener('click', () => { seedDemo(); toast('נתוני ההדגמה נטענו'); });
  $('[data-act="unseed"]', view)?.addEventListener('click', () => { clearDemo(); toast('לידי ההדגמה הוסרו'); });
  $('[data-act="reset"]', view).addEventListener('click', async () => {
    if (!(await confirmDialog('למחוק את כל הנתונים לצמיתות?', { okText: 'מחיקת הכל', danger: true }))) return;
    for (const f of await files.all()) await files.remove(f.id);
    resetState();
    toast('המערכת אופסה');
  });
}
