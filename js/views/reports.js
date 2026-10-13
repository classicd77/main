import { state, STATUSES } from '../store.js';
import { esc, icon, fmtNum, fmtMoney, fmtMoneyShort, fmtPct, fmtDate, downloadBlob, toCSV, $, $$ } from '../util.js';
import { areaChart, donut, funnel, hbars, columns, legend } from '../charts.js';
import { sum, feeRevenue, inRange, conversion, buckets, byStatus, funnelStages, groupBy, ageBand, amountBand, AGE_ORDER, AMOUNT_ORDER } from '../metrics.js';
import { exportCSV } from './leads.js';

const ui = { range: '180', folder: '', from: '', to: '' };
const RANGES = [['30', '30 יום'], ['90', '3 חודשים'], ['180', '6 חודשים'], ['365', 'שנה'], ['all', 'הכל'], ['custom', 'טווח מותאם']];

function scope() {
  let from = null, to = null;
  if (ui.range === 'custom') {
    from = ui.from ? new Date(ui.from).getTime() : null;
    to = ui.to ? new Date(ui.to).getTime() + 864e5 - 1 : null;
  } else if (ui.range !== 'all') from = Date.now() - Number(ui.range) * 864e5;
  let leads = inRange(state.leads, from, to);
  if (ui.folder) leads = leads.filter((l) => l.folderId === ui.folder);
  return { leads, from, to };
}
const ordered = (arr, order) => order.map((label) => ({ label, value: arr.find((x) => x.label === label)?.value || 0 }));

export function render(view) {
  const { leads, from, to } = scope();
  const conv = conversion(leads);
  const won = leads.filter((l) => l.status === 'won');
  const open = leads.filter((l) => !['won', 'lost'].includes(l.status));
  const withFee = leads.filter((l) => l.fee !== '' && l.fee != null && Number(l.amount));
  const wAvgFee = sum(withFee, (l) => l.amount) ? (sum(withFee, (l) => Number(l.amount) * Number(l.fee)) / sum(withFee, (l) => l.amount)) : 0;
  const days = won.filter((l) => l.wonAt).map((l) => (new Date(l.wonAt) - new Date(l.createdAt)) / 864e5);
  const avgClose = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
  const spanDays = from ? ((to || Date.now()) - from) / 864e5 : (Date.now() - Math.min(Date.now(), ...state.leads.map((l) => new Date(l.createdAt).getTime()))) / 864e5;
  const unit = spanDays > 120 ? 'month' : spanDays > 21 ? 'week' : 'day';
  const n = unit === 'month' ? Math.min(24, Math.max(2, Math.ceil(spanDays / 30.4))) : unit === 'week' ? Math.ceil(spanDays / 7) : Math.max(2, Math.ceil(spanDays));
  const end = to || Date.now();

  const statusRows = STATUSES.map((s) => {
    const ls = leads.filter((l) => l.status === s.id);
    return { s, n: ls.length, amount: sum(ls, (l) => l.amount), fee: ls.filter((l) => l.fee !== '').length ? sum(ls, (l) => l.fee) / ls.filter((l) => l.fee !== '').length : 0, rev: sum(ls, feeRevenue) };
  });

  view.innerHTML = `
    <div class="print-only"><h1 style="margin:0">דוח לידים${state.settings.company ? ' – ' + esc(state.settings.company) : ''}</h1><p>הופק ב-${fmtDate(new Date())}</p></div>
    <div class="page-head no-print"><div><h1>דוחות</h1><div class="sub">ניתוח ביצועים, המרה ופילוח לידים</div></div><span class="spacer"></span>
      <button class="btn" data-act="csv">${icon('download')}ייצוא לידים (CSV)</button>
      <button class="btn" data-act="sumcsv">${icon('table')}ייצוא סיכום</button>
      <button class="btn primary" data-act="print">${icon('printer')}הדפסה / PDF</button></div>
    <div class="toolbar no-print">
      <div class="seg">${RANGES.map(([v, l]) => `<button class="${ui.range === v ? 'on' : ''}" data-range="${v}">${l}</button>`).join('')}</div>
      ${ui.range === 'custom' ? `<input type="date" class="input sm" id="rFrom" value="${ui.from}"><span class="muted">עד</span><input type="date" class="input sm" id="rTo" value="${ui.to}">` : ''}
      <select class="input sm" id="rFolder"><option value="">כל התיקים</option>${state.folders.map((f) => `<option value="${f.id}" ${ui.folder === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
    </div>
    <div class="grid cols-4" style="margin-bottom:18px">
      ${tile('לידים בתקופה', fmtNum(leads.length), `${fmtNum(open.length)} פתוחים`)}
      ${tile('שיעור המרה', fmtPct(conv.rate), `${fmtNum(conv.won)} לקוחות · ${fmtPct(conv.closeRate, 0)} מהסגורים`)}
      ${tile('נכסים שגויסו', fmtMoneyShort(sum(won, (l) => l.amount)), `הכנסה שנתית ${fmtMoneyShort(sum(won, feeRevenue))}`)}
      ${tile('דמי ניהול משוקללים', fmtPct(wAvgFee, 2), avgClose ? `זמן סגירה ממוצע ${Math.round(avgClose)} ימים` : 'משוקלל לפי סכום')}
    </div>
    <div class="grid cols-3">
      <div class="card span-2"><div class="card-head"><h3>לידים חדשים מול סגירות</h3><span class="spacer"></span><span class="sub">לפי ${unit === 'month' ? 'חודש' : unit === 'week' ? 'שבוע' : 'יום'}</span></div><div id="rTrend"></div><div id="rTrendLg"></div></div>
      <div class="card"><div class="card-head"><h3>סטטוס לידים</h3></div><div id="rStatus"></div></div>
      <div class="card"><div class="card-head"><h3>משפך המרה</h3></div><div id="rFunnel"></div></div>
      <div class="card"><div class="card-head"><h3>מטרות השקעה</h3><span class="spacer"></span><span class="sub">סכום מבוקש</span></div><div id="rGoal"></div></div>
      <div class="card"><div class="card-head"><h3>טווח השקעה</h3><span class="spacer"></span><span class="sub">מספר לידים</span></div><div id="rHorizon"></div></div>
      <div class="card"><div class="card-head"><h3>התפלגות גילאים</h3></div><div id="rAge"></div></div>
      <div class="card"><div class="card-head"><h3>גודל השקעה</h3></div><div id="rAmt"></div></div>
      <div class="card"><div class="card-head"><h3>ערים מובילות</h3></div><div id="rCity"></div></div>
      <div class="card"><div class="card-head"><h3>מקורות ושיעורי המרה</h3></div><div id="rSrc"></div></div>
      <div class="card span-2"><div class="card-head"><h3>מקצועות מובילים</h3></div><div id="rProf"></div></div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>סיכום לפי סטטוס</h3></div>
      <div class="table-wrap" style="box-shadow:none"><table class="tbl" style="min-width:600px"><thead><tr><th>סטטוס</th><th>לידים</th><th>סכום כולל</th><th>דמי ניהול ממוצעים</th><th>הכנסה שנתית פוטנציאלית</th></tr></thead>
      <tbody>${statusRows.map((r) => `<tr style="cursor:default"><td><span class="badge"><span class="sw" style="background:${r.s.color}"></span>${esc(r.s.label)}</span></td><td class="num">${fmtNum(r.n)}</td><td class="num">${fmtMoney(r.amount)}</td><td class="num">${fmtPct(r.fee, 2)}</td><td class="num"><b>${fmtMoney(r.rev)}</b></td></tr>`).join('')}
      <tr style="cursor:default"><td><b>סה״כ</b></td><td class="num"><b>${fmtNum(leads.length)}</b></td><td class="num"><b>${fmtMoney(sum(leads, (l) => l.amount))}</b></td><td class="num">${fmtPct(wAvgFee, 2)}</td><td class="num"><b>${fmtMoney(sum(leads, feeRevenue))}</b></td></tr></tbody></table></div>
    </div>`;

  // charts
  const nb = buckets(leads, { n, unit, end });
  const wb = buckets(won, { n, unit, end, key: 'wonAt' });
  const series = [{ name: 'לידים חדשים', color: 'var(--s1)', values: nb.map((b) => b.v) }, { name: 'נסגרו כלקוחות', color: 'var(--s6)', values: wb.map((b) => b.v) }];
  areaChart($('#rTrend', view), { labels: nb.map((b) => b.label), series, height: 260 });
  $('#rTrendLg', view).innerHTML = legend(series.map((s) => ({ label: s.name, color: s.color })));
  donut($('#rStatus', view), { items: byStatus(leads), centerLabel: 'לידים' });
  funnel($('#rFunnel', view), { stages: funnelStages(leads) });
  hbars($('#rGoal', view), { items: groupBy(leads, 'goal', { value: (l) => Number(l.amount) || 0 }), fmt: fmtMoneyShort, color: 'var(--s7)' });
  hbars($('#rHorizon', view), { items: groupBy(leads, 'horizon'), color: 'var(--s3)' });
  columns($('#rAge', view), { items: ordered(groupBy(leads, (l) => ageBand(l.age), { top: 99 }), AGE_ORDER), color: 'var(--s1)', name: 'לידים' });
  columns($('#rAmt', view), { items: ordered(groupBy(leads, (l) => amountBand(l.amount), { top: 99 }), AMOUNT_ORDER), color: 'var(--s4)', name: 'לידים' });
  hbars($('#rCity', view), { items: groupBy(leads, 'city', { top: 7 }), color: 'var(--s2)' });
  const src = groupBy(leads, 'source', { top: 7 });
  hbars($('#rSrc', view), {
    items: src.map((s) => { const ls = leads.filter((l) => (l.source || 'לא צוין') === s.label); const c = conversion(ls); return { label: `${s.label} · ${fmtPct(c.rate, 0)} המרה`, value: s.value, sub: 'לידים' }; }),
    color: 'var(--s5)',
  });
  hbars($('#rProf', view), { items: groupBy(leads, 'profession', { top: 8 }), color: 'var(--s1)' });

  // events
  $$('[data-range]', view).forEach((b) => b.addEventListener('click', () => { ui.range = b.dataset.range; render(view); }));
  $('#rFrom', view)?.addEventListener('change', (e) => { ui.from = e.target.value; render(view); });
  $('#rTo', view)?.addEventListener('change', (e) => { ui.to = e.target.value; render(view); });
  $('#rFolder', view).addEventListener('change', (e) => { ui.folder = e.target.value; render(view); });
  $('[data-act="print"]', view).addEventListener('click', () => window.print());
  $('[data-act="csv"]', view).addEventListener('click', () => exportCSV(leads, 'leads-report'));
  $('[data-act="sumcsv"]', view).addEventListener('click', () => {
    const rows = [['סטטוס', 'לידים', 'סכום כולל', 'דמי ניהול ממוצעים %', 'הכנסה שנתית'], ...statusRows.map((r) => [r.s.label, r.n, Math.round(r.amount), r.fee.toFixed(2), Math.round(r.rev)])];
    downloadBlob(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }), `summary-${new Date().toISOString().slice(0, 10)}.csv`);
  });
}

const tile = (label, value, foot) => `<div class="card kpi"><div class="label">${label}</div><div class="value num">${value}</div><div class="foot">${foot}</div></div>`;
