import { state, save, createLead, findDuplicate, fullName, getLead } from '../store.js';
import { esc, icon, fmtDateTime, fmtMoney, timeAgo, toast, readAsText, confirmDialog, $, $$ } from '../util.js';
import { openLeadForm } from '../components.js';
import { parseEml, parseLeadText, emailAddr } from '../parser.js';
import { syncInbox, ingest, scriptReady } from '../mailer.js';

let tab = 'pending';
const LABELS = { firstName: 'שם פרטי', lastName: 'שם משפחה', phone: 'טלפון', email: 'אימייל', city: 'עיר', age: 'גיל', profession: 'מקצוע', horizon: 'טווח השקעה', goal: 'מטרה', amount: 'סכום', fee: 'דמי ניהול' };

const SAMPLE = `שם מלא: רונית אברהמי
טלפון: 052-7788991
אימייל: ronit.a@example.com
עיר מגורים: הרצליה
גיל: 47
מקצוע: רופאת שיניים
טווח השקעה: 5 שנים
מטרת ההשקעה: צמיחת הון
סכום השקעה: 1.2 מיליון
הודעה: מעוניינת לשמוע על ניהול תיק אישי, כרגע הכסף בבנק.`;

export function render(view) {
  const st = state.settings;
  const pending = state.inbox.filter((m) => m.status === 'pending');
  const done = state.inbox.filter((m) => m.status !== 'pending');
  const list = tab === 'pending' ? pending : done;

  view.innerHTML = `
    <div class="page-head">
      <div><h1>קליטת לידים ממייל</h1><div class="sub">${st.leadSourceEmail ? `לידים שמגיעים מ-<b class="ltr">${esc(st.leadSourceEmail)}</b> נקלטים לכאן לבדיקה ויצירה` : 'הדביקו מייל, גררו קובץ ‎.eml‎, או חברו את תיבת המייל בהגדרות'}</div></div>
      <span class="spacer"></span>
      <a class="btn" href="#/settings?tab=email">${icon('settings')}הגדרות קליטה</a>
      <button class="btn primary" data-act="sync" ${st.leadSourceEmail && scriptReady() ? '' : 'disabled'}>${icon('refresh')}סנכרון עכשיו</button>
    </div>

    ${!st.leadSourceEmail || !scriptReady() ? `<div class="callout" style="margin-bottom:18px">${icon('sparkle')}<div><b>חיבור אוטומטי לתיבת המייל</b><div class="small ink2">כדי שלידים יגיעו אוטומטית, הגדירו בהגדרות את כתובת המייל שממנה מגיעים הלידים ואת גשר ה-Gmail (סקריפט חינמי של גוגל, הגדרה של 2 דקות). בינתיים אפשר להדביק את תוכן המייל או לגרור קובץ ‎.eml‎ למטה.</div></div><a class="btn sm" href="#/settings?tab=email" style="margin-inline-start:auto">להגדרה</a></div>`
      : `<div class="callout info" style="margin-bottom:18px">${icon('check')}<div><b>מחובר</b><div class="small ink2">סנכרון אחרון: ${st.lastSync ? fmtDateTime(st.lastSync) : 'טרם בוצע'}${st.autoSyncMin ? ` · סנכרון אוטומטי כל ${st.autoSyncMin} דקות` : ''}</div></div></div>`}

    <div class="grid cols-2" style="margin-bottom:18px">
      <div class="card">
        <div class="card-head"><h3>${icon('note')} הדבקת תוכן מייל / פרטי ליד</h3><span class="spacer"></span><button class="btn sm ghost" data-act="sample">דוגמה</button></div>
        <textarea class="input" id="pasteBox" rows="8" placeholder="הדביקו כאן את גוף המייל שהתקבל (שם: …, טלפון: …, סכום: …). המערכת תזהה את השדות אוטומטית."></textarea>
        <div class="row" style="margin-top:10px"><span class="small muted">מזהה שדות בעברית ובאנגלית</span><span class="spacer"></span><button class="btn primary" data-act="parse">${icon('sparkle')}זיהוי ויצירת ליד</button></div>
      </div>
      <div class="card" style="display:flex;flex-direction:column">
        <div class="card-head"><h3>${icon('upload')} ייבוא קבצי מייל</h3></div>
        <label class="dropzone" id="emlDrop" style="flex:1;display:grid;place-content:center">
          <div class="big">${icon('mail')}</div>
          <div><b>גררו לכאן קבצי ‎.eml‎</b> או לחצו לבחירה</div>
          <div class="small">ב-Gmail: ⋮ ← "הורדת ההודעה". ב-Outlook: גרירת המייל לשולחן העבודה.</div>
          <input type="file" id="emlInput" accept=".eml,message/rfc822,.txt" multiple hidden>
        </label>
      </div>
    </div>

    <div class="row" style="margin-bottom:12px">
      <div class="seg"><button class="${tab === 'pending' ? 'on' : ''}" data-tab="pending">ממתינים לטיפול (${pending.length})</button><button class="${tab === 'done' ? 'on' : ''}" data-tab="done">טופלו (${done.length})</button></div>
      <span class="spacer"></span>
      ${tab === 'pending' && pending.length ? `<button class="btn" data-act="createAll">${icon('check')}יצירת כל הלידים</button>` : ''}
      ${tab === 'done' && done.length ? `<button class="btn ghost" data-act="clearDone">${icon('trash')}ניקוי היסטוריה</button>` : ''}
    </div>
    ${list.length ? `<div class="grid">${list.map(itemCard).join('')}</div>` : `<div class="card"><div class="empty"><div class="big">${icon('inbox')}</div><h3>${tab === 'pending' ? 'אין מיילים שממתינים לטיפול' : 'אין היסטוריה'}</h3></div></div>`}`;

  // events
  $$('[data-tab]', view).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(view); }));
  $('[data-act="sample"]', view).addEventListener('click', () => ($('#pasteBox', view).value = SAMPLE));
  $('[data-act="parse"]', view).addEventListener('click', () => {
    const txt = $('#pasteBox', view).value.trim();
    if (!txt) return toast('הדביקו תוכן מייל', 'err');
    const parsed = parseLeadText(txt, { excludeEmails: [emailAddr(st.leadSourceEmail)].filter(Boolean) });
    $('#pasteBox', view).value = '';
    openLeadForm(null, { ...parsed, conversation: parsed.conversation || '' }, { source: 'מייל' });
  });
  $('[data-act="sync"]', view).addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    b.innerHTML = icon('refresh') + 'מסנכרן…';
    try {
      const n = await syncInbox();
      toast(n ? `התקבלו ${n} מיילים חדשים` : 'אין מיילים חדשים');
    } catch (err) {
      toast(err.message, 'err');
      render(view);
    }
  });
  const drop = $('#emlDrop', view), inp = $('#emlInput', view);
  const handle = async (fl) => {
    const msgs = [];
    for (const f of fl) {
      try { const m = parseEml(await readAsText(f)); msgs.push({ ...m, id: m.messageId || f.name + f.size }); } catch (err) { console.error(err); }
    }
    const n = ingest(msgs);
    tab = 'pending';
    toast(n ? `נקלטו ${n} מיילים` : 'המיילים כבר נקלטו בעבר', n ? 'ok' : 'err');
  };
  inp.addEventListener('change', () => handle([...inp.files]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handle([...e.dataTransfer.files]); });

  const byId = (id) => state.inbox.find((m) => m.id === id);
  const finish = (m, lead) => { m.status = 'imported'; m.leadId = lead.id; save(); };
  const build = (m) => ({ ...m.parsed, conversation: [m.parsed.conversation, `— התקבל במייל: "${m.subject}" (${fmtDateTime(m.date)})`].filter(Boolean).join('\n\n'), createdAt: m.date && new Date(m.date) < new Date() ? m.date : new Date().toISOString() });
  $$('[data-review]', view).forEach((b) => b.addEventListener('click', () => {
    const m = byId(b.dataset.review);
    openLeadForm(null, build(m), { source: 'מייל', onSaved: (lead) => { finish(m, lead); toast('הליד נוצר'); } });
  }));
  $$('[data-quick]', view).forEach((b) => b.addEventListener('click', () => {
    const m = byId(b.dataset.quick);
    if (!m.parsed.firstName && !m.parsed.lastName && !m.parsed.email && !m.parsed.phone) return toast('לא זוהו פרטים – השתמשו ב"בדיקה ועריכה"', 'err');
    const lead = createLead(build(m), { source: 'מייל', note: 'ליד נקלט ממייל: ' + m.subject });
    finish(m, lead);
    toast(`נוצר ליד: ${fullName(lead)}`);
  }));
  $$('[data-dismiss]', view).forEach((b) => b.addEventListener('click', () => { byId(b.dataset.dismiss).status = 'dismissed'; save(); }));
  $$('[data-restore]', view).forEach((b) => b.addEventListener('click', () => { byId(b.dataset.restore).status = 'pending'; save(); }));
  $('[data-act="createAll"]', view)?.addEventListener('click', async () => {
    const ok = pending.filter((m) => (m.parsed.firstName || m.parsed.email || m.parsed.phone) && !findDuplicate(m.parsed));
    if (!(await confirmDialog(`ליצור ${ok.length} לידים? (מיילים ללא פרטים מזוהים או כפולים יידלגו)`))) return;
    ok.forEach((m) => finish(m, createLead(build(m), { source: 'מייל', note: 'ליד נקלט ממייל: ' + m.subject })));
    toast(`נוצרו ${ok.length} לידים`);
  });
  $('[data-act="clearDone"]', view)?.addEventListener('click', () => { state.inbox = state.inbox.filter((m) => m.status === 'pending'); save(); });
}

function itemCard(m) {
  const p = m.parsed || {};
  const dup = findDuplicate(p);
  const lead = m.leadId && getLead(m.leadId);
  const fields = Object.keys(LABELS).filter((k) => p[k] !== undefined && p[k] !== '');
  return `<div class="card">
    <div class="row wrap" style="align-items:flex-start">
      <div class="grow" style="min-width:220px">
        <div class="row"><span class="k-ic" style="color:var(--accent)">${icon('mail')}</span><b class="ellipsis">${esc(m.subject || '(ללא נושא)')}</b></div>
        <div class="small muted">${esc(m.from)} · ${timeAgo(m.date)}</div>
      </div>
      ${m.status === 'pending' ? `
        <button class="btn sm" data-dismiss="${m.id}">${icon('x')}דחייה</button>
        <button class="btn sm" data-review="${m.id}">${icon('edit')}בדיקה ועריכה</button>
        <button class="btn sm primary" data-quick="${m.id}">${icon('plus')}יצירת ליד</button>`
      : m.status === 'imported' ? (lead ? `<a class="btn sm" href="#/lead/${lead.id}">${icon('user')}${esc(fullName(lead))}</a>` : '<span class="badge">נוצר ליד</span>')
      : `<span class="badge">נדחה</span><button class="btn sm" data-restore="${m.id}">שחזור</button>`}
    </div>
    ${fields.length ? `<div class="row wrap" style="margin-top:12px;gap:6px">${fields.map((k) => `<span class="badge"><span class="muted">${LABELS[k]}:</span> ${esc(k === 'amount' ? fmtMoney(p[k]) : k === 'fee' ? p[k] + '%' : p[k])}</span>`).join('')}</div>` : `<div class="small muted" style="margin-top:10px">${icon('alert')} לא זוהו שדות מובנים – בדקו את התוכן ידנית</div>`}
    ${dup && m.status === 'pending' ? `<div class="callout" style="margin-top:10px;padding:8px 12px">${icon('alert')}<span class="small">ייתכן שזה ליד קיים: <a href="#/lead/${dup.id}"><b>${esc(fullName(dup))}</b></a></span></div>` : ''}
    <details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">תוכן המייל המלא</summary><div class="email-preview" style="margin-top:8px">${esc(m.body)}</div></details>
  </div>`;
}
