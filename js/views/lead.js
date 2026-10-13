import { state, save, getLead, fullName, leadScore, updateLead, deleteLeads, addActivity, PIPELINE, STATUSES, statusById, stageIndex, ACTIVITY_TYPES } from '../store.js';
import { esc, icon, fmtMoney, fmtPct, fmtDate, fmtDateTime, timeAgo, avatar, dueBadge, confirmDialog, promptDialog, toast, toISODate, intlPhone, $, $$ } from '../util.js';
import { statusBadge, prioBadge, folderBadge, openLeadForm, openComposer } from '../components.js';
import { feeRevenue } from '../metrics.js';

let actType = 'call';

export function render(view, params, id) {
  const l = getLead(id);
  if (!l) {
    view.innerHTML = `<div class="card"><div class="empty"><div class="big">${icon('user')}</div><h3>הליד לא נמצא</h3><a class="btn" href="#/leads">חזרה ללידים</a></div></div>`;
    return;
  }
  const cur = stageIndex(l.status);
  const kv = (k, v, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v === '' || v == null ? '<span class="muted">—</span>' : v}</dd>`;
  const emails = state.emails.filter((e) => (e.leadIds || []).includes(l.id));
  const score = leadScore(l);

  view.innerHTML = `
    <a href="#/leads" class="row small muted" style="text-decoration:none;margin-bottom:14px;display:inline-flex">${icon('arrowRight')}חזרה לרשימת הלידים</a>
    <div class="card">
      <div class="lead-head">
        ${avatar(l, 'lg')}
        <div class="grow">
          <h1>${esc(fullName(l))}</h1>
          <div class="row wrap" style="margin-top:6px">${statusBadge(l.status)}${prioBadge(l.priority)}${folderBadge(l.folderId)}<span class="badge">${icon('inbox')}${esc(l.source || '')}</span>${l.archived ? `<span class="badge">${icon('archive')}בארכיון</span>` : ''}
            <span class="score" title="ציון ליד – מבוסס על גודל העסקה, שלב, זמינות ועדכניות"><span class="score-bar" style="width:80px"><i style="width:${score}%"></i></span><b class="num">${score}</b><span class="small muted">ציון</span></span></div>
          <div class="row wrap small muted" style="margin-top:8px">${(l.tags || []).map((t) => `<span class="tag">${esc(t)}<button data-untag="${esc(t)}" title="הסרה">${icon('x')}</button></span>`).join('')}<button class="chip" data-act="tag" style="padding:2px 10px;font-size:12px">${icon('tag')} תגית</button></div>
        </div>
        <div class="quick-actions">
          ${l.phone ? `<a class="btn" href="tel:${esc(l.phone)}" data-log="call">${icon('phone')}חיוג</a><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${esc(intlPhone(l.phone))}" data-log="whatsapp">${icon('whatsapp')}וואטסאפ</a>` : ''}
          <button class="btn" data-act="email" ${l.email ? '' : 'disabled title="אין כתובת מייל"'}>${icon('mail')}מייל</button>
          <button class="btn primary" data-act="edit">${icon('edit')}עריכה</button>
          <button class="icon-btn" data-act="archive" title="${l.archived ? 'שחזור מהארכיון' : 'העברה לארכיון'}">${icon('archive')}</button>
          <button class="icon-btn danger" data-act="delete" title="מחיקה">${icon('trash')}</button>
        </div>
      </div>
      <div class="stepper">${PIPELINE.map((s, i) => `<div class="step ${l.status === s.id ? 'cur' : l.status !== 'lost' && i < cur ? 'done' : ''}" style="--c:${s.color}" data-status="${s.id}">${esc(s.label)}</div>`).join('')}</div>
      <div class="row small" style="justify-content:space-between"><span class="muted">לחיצה על שלב מעדכנת את הסטטוס</span>
        <button class="btn sm ${l.status === 'lost' ? 'danger' : 'ghost'}" data-status="lost">${icon('x')}${l.status === 'lost' ? 'סומן כלא רלוונטי' : 'סימון כלא רלוונטי'}</button></div>
    </div>

    <div class="lead-layout">
      <div class="grid" style="align-content:start">
        <div class="money-strip">
          <div class="money"><div class="l">סכום השקעה</div><div class="v num">${l.amount ? fmtMoney(l.amount) : '—'}</div></div>
          <div class="money"><div class="l">דמי ניהול מוצעים</div><div class="v num">${l.fee !== '' && l.fee != null ? fmtPct(l.fee, 2) : '—'}</div></div>
          <div class="money"><div class="l">הכנסה שנתית צפויה</div><div class="v num" style="color:var(--accent)">${l.amount && l.fee ? fmtMoney(feeRevenue(l)) : '—'}</div></div>
        </div>
        <div class="card">
          <div class="section-title">פרטים אישיים</div>
          <dl class="kv">
            ${kv('שם פרטי', esc(l.firstName))}${kv('שם משפחה', esc(l.lastName))}
            ${kv('טלפון נייד', l.phone ? `<a href="tel:${esc(l.phone)}" class="ltr">${esc(l.phone)}</a>` : '')}
            ${kv('אימייל', l.email ? `<a href="mailto:${esc(l.email)}" class="ltr">${esc(l.email)}</a>` : '')}
            ${kv('עיר מגורים', esc(l.city))}${kv('גיל', esc(l.age))}${kv('מקצוע', esc(l.profession))}
          </dl>
          <div class="section-title">פרופיל השקעה</div>
          <dl class="kv">
            ${kv('טווח השקעה', esc(l.horizon))}${kv('מטרת ההשקעה', esc(l.goal))}
            ${kv('סכום', l.amount ? fmtMoney(l.amount) : '', 'num')}${kv('דמי ניהול מוצעים', l.fee !== '' && l.fee != null ? fmtPct(l.fee, 2) : '', 'num')}
          </dl>
          <div class="section-title">פירוט השיחה</div>
          <textarea class="input" id="conv" rows="7" placeholder="סיכום השיחה, צרכים, התנגדויות…">${esc(l.conversation)}</textarea>
          <div class="row" style="margin-top:8px"><span class="small muted" id="convState">נשמר אוטומטית ביציאה מהשדה</span><span class="spacer"></span></div>
          <div class="section-title">פרטי מערכת</div>
          <dl class="kv small">${kv('נוצר', fmtDateTime(l.createdAt))}${kv('עודכן', fmtDateTime(l.updatedAt))}${l.wonAt ? kv('נסגר', fmtDateTime(l.wonAt)) : ''}</dl>
        </div>
        <div class="card">
          <div class="card-head"><h3>מיילים שנשלחו</h3><span class="spacer"></span><button class="btn sm" data-act="email" ${l.email ? '' : 'disabled'}>${icon('send')}מייל חדש</button></div>
          ${emails.length ? `<div class="list">${emails.map((e) => `<details class="list-item" style="display:block"><summary class="row" style="cursor:pointer"><span class="grow ellipsis"><b>${esc(e.subject)}</b></span><span class="small muted">${fmtDateTime(e.at)}</span></summary><div class="email-preview" style="margin-top:8px">${esc(e.body)}</div>${e.attachments?.length ? `<div class="small muted" style="margin-top:6px">${icon('file')} ${e.attachments.map(esc).join(', ')}</div>` : ''}</details>`).join('')}</div>` : '<div class="muted small">טרם נשלחו מיילים לליד זה</div>'}
        </div>
      </div>

      <div class="grid" style="align-content:start">
        <div class="card">
          <div class="card-head"><h3>${icon('calendar')} מעקב הבא</h3><span class="spacer"></span>${l.nextFollowUp ? dueBadge(l.nextFollowUp) : ''}</div>
          <div class="row wrap">
            <input type="date" class="input" id="nextFu" value="${esc(l.nextFollowUp)}" style="flex:1;min-width:150px">
            ${l.nextFollowUp ? `<button class="btn sm" data-fu="">${icon('check')}בוצע</button>` : ''}
          </div>
          <div class="row wrap" style="margin-top:8px">${[[1, 'מחר'], [3, 'בעוד 3 ימים'], [7, 'בעוד שבוע'], [14, 'בעוד שבועיים']].map(([d, t]) => `<button class="chip" data-fu="${d}" style="font-size:12px;padding:4px 10px">${t}</button>`).join('')}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>מעקב ופעילות</h3><span class="spacer"></span><span class="sub">${l.activities.length} רשומות</span></div>
          <div class="composer">
            <div class="seg" style="align-self:flex-start">${['call', 'meeting', 'note', 'whatsapp'].map((t) => `<button data-type="${t}" class="${actType === t ? 'on' : ''}">${icon(ACTIVITY_TYPES[t].icon)}${ACTIVITY_TYPES[t].label}</button>`).join('')}</div>
            <textarea class="input" id="actText" rows="3" placeholder="מה היה בשיחה / בפגישה? (Ctrl+Enter לשמירה)"></textarea>
            <div class="row"><span class="spacer"></span><button class="btn primary sm" data-act="logAct">${icon('plus')}הוספה ליומן</button></div>
          </div>
          <div class="timeline">${l.activities.map((a) => `
            <div class="tl-item"><div class="tl-dot">${icon(ACTIVITY_TYPES[a.type]?.icon || 'note')}</div>
              <div class="tl-body"><div class="row"><span class="small" style="font-weight:700">${esc(ACTIVITY_TYPES[a.type]?.label || '')}</span><span class="spacer"></span><button class="icon-btn sm" data-delact="${a.id}" title="מחיקה" style="border:0;background:none">${icon('x')}</button></div>
              <div class="t">${esc(a.text)}</div><div class="d">${fmtDateTime(a.at)} · ${timeAgo(a.at)}</div></div></div>`).join('')}</div>
        </div>
      </div>
    </div>`;

  // --- events ---
  $$('[data-status]', view).forEach((s) => s.addEventListener('click', () => {
    if (s.dataset.status === l.status) return;
    updateLead(l, { status: s.dataset.status });
    toast('הסטטוס עודכן ל' + statusById(s.dataset.status).label);
  }));
  $$('[data-act="email"]', view).forEach((b) => b.addEventListener('click', () => openComposer({ leads: [l] })));
  $('[data-act="edit"]', view).addEventListener('click', () => openLeadForm(l));
  $('[data-act="archive"]', view).addEventListener('click', () => { updateLead(l, { archived: !l.archived }); toast(l.archived ? 'הליד הועבר לארכיון' : 'הליד שוחזר'); });
  $('[data-act="delete"]', view).addEventListener('click', async () => {
    if (await confirmDialog(`למחוק את ${fullName(l)} לצמיתות?`, { okText: 'מחיקה', danger: true })) { location.hash = '#/leads'; deleteLeads([l.id]); toast('הליד נמחק'); }
  });
  $('[data-act="tag"]', view).addEventListener('click', async () => {
    const t = await promptDialog('הוספת תגית', { placeholder: 'לדוגמה: VIP' });
    if (t && !l.tags.includes(t)) updateLead(l, { tags: [...l.tags, t] });
  });
  $$('[data-untag]', view).forEach((b) => b.addEventListener('click', () => updateLead(l, { tags: l.tags.filter((t) => t !== b.dataset.untag) })));
  $$('[data-log]', view).forEach((a) => a.addEventListener('click', () => {
    addActivity(l, a.dataset.log, a.dataset.log === 'call' ? 'חיוג יוצא' : 'נפתחה שיחת וואטסאפ');
    updateLead(l, {});
  }));
  const conv = $('#conv', view);
  conv.addEventListener('input', () => ($('#convState', view).textContent = 'שינויים לא שמורים…'));
  conv.addEventListener('blur', () => {
    if (conv.value !== (l.conversation || '')) { updateLead(l, { conversation: conv.value }); toast('פירוט השיחה נשמר'); }
  });
  $('#nextFu', view).addEventListener('change', (e) => updateLead(l, { nextFollowUp: e.target.value }));
  $$('[data-fu]', view).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.fu === '') { addActivity(l, 'note', 'מעקב בוצע'); updateLead(l, { nextFollowUp: '' }); return toast('המעקב סומן כבוצע'); }
    const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.fu));
    updateLead(l, { nextFollowUp: toISODate(d) });
    toast('נקבע מעקב ל-' + fmtDate(d));
  }));
  $$('[data-type]', view).forEach((b) => b.addEventListener('click', () => { actType = b.dataset.type; $$('[data-type]', view).forEach((x) => x.classList.toggle('on', x === b)); }));
  const logAct = () => {
    const t = $('#actText', view).value.trim();
    if (!t) return $('#actText', view).focus();
    addActivity(l, actType, t);
    $('#actText', view).value = '';
    $('#actText', view).blur();
    updateLead(l, {});
    toast('נוסף ליומן');
  };
  $('[data-act="logAct"]', view).addEventListener('click', logAct);
  $('#actText', view).addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) logAct(); });
  $$('[data-delact]', view).forEach((b) => b.addEventListener('click', () => { l.activities = l.activities.filter((a) => a.id !== b.dataset.delact); save(); }));
}
