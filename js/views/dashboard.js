import { state, save, WIDGETS, activeLeads, fullName, getLead, ACTIVITY_TYPES, statusById } from '../store.js';
import { esc, icon, fmtNum, fmtMoneyShort, fmtPct, timeAgo, avatar, dueBadge, dayDiff, openModal, $, $$ } from '../util.js';
import { areaChart, donut, funnel, hbars, columns, sparkline, legend } from '../charts.js';
import { isOpen, sum, feeRevenue, inRange, conversion, buckets, byStatus, funnelStages, groupBy } from '../metrics.js';
import { statusBadge, openLeadForm } from '../components.js';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
}

const removeBtn = (id) => `<button class="icon-btn sm widget-x no-print" data-remove="${id}" title="הסרת הווידג׳ט מהדשבורד">${icon('x')}</button>`;

export function render(view) {
  const leads = activeLeads();
  const w = new Set(state.settings.widgets);
  const open = leads.filter(isOpen);
  const now = Date.now();
  const d30 = now - 30 * 864e5, d60 = now - 60 * 864e5;
  const new30 = inRange(leads, d30).length;
  const prev30 = inRange(leads, d60, d30).length;
  const conv = conversion(leads);
  const pipelineValue = sum(open, (l) => l.amount);
  const won = leads.filter((l) => l.status === 'won');
  const wonAUM = sum(won, (l) => l.amount);
  const wonRevenue = sum(won, feeRevenue);
  const pipeRevenue = sum(open, feeRevenue);
  const due = open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) <= 0);
  const weekly = buckets(leads, { n: 8 });
  const wonWeekly = buckets(won, { n: 8, key: 'wonAt' });
  const delta = prev30 ? Math.round(((new30 - prev30) / prev30) * 100) : null;
  const deltaHTML = delta == null ? '' : `<span class="delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}">${icon(delta >= 0 ? 'arrowUp' : 'arrowDown')}${Math.abs(delta)}%</span>`;

  const cards = [];
  if (w.has('hero')) cards.push(`
    <section class="hero widget span-all">
      ${removeBtn('hero')}
      <div>
        <div class="greet">${greeting()}${state.settings.advisorName ? ', ' + esc(state.settings.advisorName) : ''} ✦</div>
        <h2>שווי הצנרת הפתוחה</h2>
        <div class="hero-figure num">${fmtMoneyShort(pipelineValue)}</div>
        <p>${fmtNum(open.length)} לידים פעילים · פוטנציאל דמי ניהול שנתיים <b class="num">${fmtMoneyShort(pipeRevenue)}</b></p>
        <div class="hero-actions no-print">
          <button class="btn primary" data-act="add">${icon('plus')}ליד חדש</button>
          <a class="btn" href="#/inbox">${icon('inbox')}קליטה ממייל</a>
          <button class="btn" data-act="customize">${icon('layout')}התאמת הדשבורד</button>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v num">${fmtNum(new30)}</div><div class="l">לידים חדשים · 30 יום</div></div>
        <div class="hero-stat"><div class="v num">${fmtNum(due.length)}</div><div class="l">מעקבים להיום</div></div>
        <div class="hero-stat"><div class="v num">${fmtPct(conv.closeRate, 0)}</div><div class="l">שיעור סגירה</div></div>
        <div class="hero-stat"><div class="v num">${fmtMoneyShort(wonAUM)}</div><div class="l">נכסים שגויסו</div></div>
        <div class="hero-stat"><div class="v num">${fmtMoneyShort(wonRevenue)}</div><div class="l">הכנסה שנתית</div></div>
        <div class="hero-stat"><div class="v num">${fmtNum(won.length)}</div><div class="l">לקוחות שנסגרו</div></div>
      </div>
    </section>`);

  if (w.has('kpis')) {
    const avgFee = open.filter((l) => l.fee !== '' && l.fee != null).length ? sum(open, (l) => l.fee) / open.filter((l) => l.fee !== '' && l.fee != null).length : 0;
    const avgAmt = open.length ? pipelineValue / open.length : 0;
    cards.push(`<div class="grid cols-4 span-all widget" style="gap:18px">
      ${removeBtn('kpis')}
      ${kpi('users', 'לידים פעילים', fmtNum(open.length), `מתוך ${fmtNum(leads.length)} בסך הכל`, sparkline(weekly.map((b) => b.v), 'var(--s1)'))}
      ${kpi('sparkle', 'לידים חדשים (30 יום)', fmtNum(new30), `${deltaHTML} לעומת 30 הימים הקודמים`, sparkline(weekly.map((b) => b.v), 'var(--s3)'))}
      ${kpi('target', 'שיעור המרה', fmtPct(conv.rate, 1), `${fmtNum(conv.won)} נסגרו בהצלחה`, sparkline(wonWeekly.map((b) => b.v), 'var(--s6)'))}
      ${kpi('coins', 'השקעה ממוצעת לליד', fmtMoneyShort(avgAmt), `דמי ניהול ממוצעים <b class="num">${fmtPct(avgFee, 2)}</b>`, '')}
    </div>`);
  }
  if (w.has('trend')) cards.push(card('trend', 'מגמת לידים', '12 שבועות אחרונים', '<div id="chTrend"></div><div id="lgTrend"></div>', 'span-2'));
  if (w.has('status')) cards.push(card('status', 'פילוח לפי סטטוס', 'לחצו על פלח לסינון', '<div id="chStatus"></div>'));
  if (w.has('funnel')) cards.push(card('funnel', 'משפך המרה', 'כמה לידים הגיעו לכל שלב', '<div id="chFunnel"></div>'));
  if (w.has('followups')) {
    const list = open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) <= 7).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp)).slice(0, 7);
    cards.push(card('followups', 'מעקבים קרובים', `<a href="#/followups">לכל המעקבים</a>`, list.length ? `<div class="list">${list.map((l) => `
      <div class="list-item" data-lead="${l.id}">${avatar(l)}<div class="grow"><div class="ellipsis"><b>${esc(fullName(l))}</b></div><div class="small muted ellipsis">${esc(statusById(l.status).label)} · ${fmtMoneyShort(l.amount)}</div></div>${dueBadge(l.nextFollowUp)}</div>`).join('')}</div>` : empty('check', 'אין מעקבים פתוחים לשבוע הקרוב')));
  }
  if (w.has('recent')) {
    const list = leads.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
    cards.push(card('recent', 'לידים אחרונים', `<a href="#/leads">לכל הלידים</a>`, list.length ? `<div class="list">${list.map((l) => `
      <div class="list-item" data-lead="${l.id}">${avatar(l)}<div class="grow"><div class="ellipsis"><b>${esc(fullName(l))}</b></div><div class="small muted ellipsis">${esc(l.city || '')} ${l.goal ? '· ' + esc(l.goal) : ''}</div></div><div style="text-align:end">${statusBadge(l.status)}<div class="small muted">${timeAgo(l.createdAt)}</div></div></div>`).join('')}</div>` : empty('users', 'עדיין אין לידים')));
  }
  if (w.has('goals')) cards.push(card('goals', 'מטרות השקעה', 'לפי היקף השקעה מבוקש', '<div id="chGoals"></div>'));
  if (w.has('sources')) cards.push(card('sources', 'מקורות לידים', 'מספר לידים לפי מקור', '<div id="chSources"></div>'));
  if (w.has('activity')) {
    const acts = leads.flatMap((l) => l.activities.slice(0, 5).map((a) => ({ ...a, lead: l }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    cards.push(card('activity', 'פעילות אחרונה', '', acts.length ? `<div class="timeline">${acts.map((a) => `
      <div class="tl-item" data-lead="${a.lead.id}" style="cursor:pointer"><div class="tl-dot">${icon(ACTIVITY_TYPES[a.type]?.icon || 'note')}</div><div class="tl-body"><div class="t"><b>${esc(fullName(a.lead))}</b> · ${esc(a.text)}</div><div class="d">${timeAgo(a.at)}</div></div></div>`).join('')}</div>` : empty('clock', 'אין פעילות עדיין')));
  }

  view.innerHTML = `
    <div class="page-head no-print">
      <div><h1>דשבורד</h1><div class="sub">${new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
      <span class="spacer"></span>
      ${state.leads.length === 0 ? `<button class="btn" data-act="demo">${icon('database')}טעינת נתוני הדגמה</button>` : ''}
      <button class="btn" data-act="customize">${icon('layout')}הוספה / הסרה של רכיבים</button>
    </div>
    ${cards.length ? `<div class="grid cols-3" id="dashGrid">${cards.join('')}</div>` : `<div class="card">${empty('layout', 'הדשבורד ריק – לחצו על "הוספה / הסרה של רכיבים"')}</div>`}`;

  // charts
  if (w.has('trend')) {
    const nb = buckets(leads, { n: 12 });
    const wb = buckets(won, { n: 12, key: 'wonAt' });
    const series = [{ name: 'לידים חדשים', color: 'var(--s1)', values: nb.map((b) => b.v) }, { name: 'נסגרו כלקוחות', color: 'var(--s6)', values: wb.map((b) => b.v) }];
    areaChart($('#chTrend', view), { labels: nb.map((b) => b.label), series, height: 250 });
    $('#lgTrend', view).innerHTML = legend(series.map((s) => ({ label: s.name, color: s.color })));
  }
  if (w.has('status')) donut($('#chStatus', view), { items: byStatus(leads), centerLabel: 'לידים', onClick: (it) => (location.hash = '#/leads?status=' + it.id) });
  if (w.has('funnel')) funnel($('#chFunnel', view), { stages: funnelStages(leads) });
  if (w.has('goals')) hbars($('#chGoals', view), { items: groupBy(leads, 'goal', { value: (l) => Number(l.amount) || 0, top: 6 }).map((x) => ({ ...x, sub: 'סכום מבוקש' })), fmt: fmtMoneyShort, color: 'var(--s7)' });
  if (w.has('sources')) columns($('#chSources', view), { items: groupBy(leads, 'source', { top: 6 }), color: 'var(--s2)', name: 'לידים', height: 230 });

  // events
  $$('[data-lead]', view).forEach((el) => el.addEventListener('click', () => (location.hash = '#/lead/' + el.dataset.lead)));
  $$('[data-remove]', view).forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    state.settings.widgets = state.settings.widgets.filter((x) => x !== b.dataset.remove);
    save();
  }));
  $$('[data-act="customize"]', view).forEach((b) => b.addEventListener('click', customize));
  $$('[data-act="add"]', view).forEach((b) => b.addEventListener('click', () => openLeadForm()));
  $$('[data-act="demo"]', view).forEach((b) => b.addEventListener('click', async () => { (await import('../store.js')).seedDemo(); }));
}

function kpi(ic, label, value, foot, spark) {
  return `<div class="card kpi"><div class="label"><span class="k-ic">${icon(ic)}</span>${label}</div><div class="value num">${value}</div><div class="foot">${foot}</div>${spark}</div>`;
}
function card(id, title, sub, body, cls = '') {
  return `<section class="card widget ${cls}">${removeBtn(id)}<div class="card-head"><h3>${title}</h3><span class="spacer"></span><span class="sub">${sub}</span></div>${body}</section>`;
}
const empty = (ic, t) => `<div class="empty" style="padding:28px 10px"><div class="big">${icon(ic)}</div><div>${t}</div></div>`;

function customize() {
  const sel = new Set(state.settings.widgets);
  const { el, close } = openModal({
    title: 'התאמת הדשבורד',
    body: `<p class="muted" style="margin-top:0">בחרו אילו רכיבים יוצגו בדשבורד. ניתן גם להסיר רכיב ישירות בלחיצה על ה-✕ שמופיע במעבר עכבר.</p>
      <div class="widget-picker">${WIDGETS.map((w) => `<label class="widget-opt ${sel.has(w.id) ? 'on' : ''}"><input type="checkbox" class="check" value="${w.id}" ${sel.has(w.id) ? 'checked' : ''}><span>${esc(w.label)}</span></label>`).join('')}</div>`,
    foot: `<button class="btn ghost" data-all>הצגת הכל</button><span class="spacer"></span><button class="btn" data-close>ביטול</button><button class="btn primary" data-ok>שמירה</button>`,
  });
  $$('input', el).forEach((c) => c.addEventListener('change', () => c.closest('.widget-opt').classList.toggle('on', c.checked)));
  $('[data-all]', el).addEventListener('click', () => $$('input', el).forEach((c) => { c.checked = true; c.closest('.widget-opt').classList.add('on'); }));
  $('[data-ok]', el).addEventListener('click', () => {
    const chosen = new Set($$('input:checked', el).map((c) => c.value));
    state.settings.widgets = WIDGETS.map((w) => w.id).filter((id) => chosen.has(id));
    close();
    save();
  });
}
