// Lightweight SVG/HTML charts with hover tooltips. Colors come from CSS tokens
// (--s1…--s8) so light/dark modes swap automatically.
import { esc, fmtNum } from './util.js';

const tip = () => document.getElementById('chartTip');
function showTip(e, html) {
  const t = tip();
  t.innerHTML = html;
  t.hidden = false;
  const x = Math.min(Math.max(e.clientX, 90), window.innerWidth - 90);
  t.style.left = x + 'px';
  t.style.top = Math.max(e.clientY, 70) + 'px';
}
const hideTip = () => { tip().hidden = true; };
const tipRows = (title, rows) =>
  `<div class="h">${esc(title)}</div>` +
  rows.map((r) => `<div class="r"><span class="k">${r.color ? `<span class="sw" style="background:${r.color}"></span>` : ''}${esc(r.k)}</span><span class="v">${esc(r.v)}</span></div>`).join('');

// Re-render on container resize so text stays crisp at real pixel size.
const observed = new WeakMap();
function responsive(el, draw) {
  draw(el.clientWidth || 600);
  if (observed.has(el)) observed.get(el).disconnect();
  let w = el.clientWidth;
  const ro = new ResizeObserver(() => {
    if (!el.isConnected) return ro.disconnect();
    if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; draw(w); }
  });
  ro.observe(el);
  observed.set(el, ro);
}

function niceMax(v) {
  if (v <= 0) return 4;
  // small integer counts: keep the 4 gridlines on whole numbers
  if (v <= 40 && Number.isInteger(v)) return Math.max(4, Math.ceil(v / 4) * 4);
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

/**
 * Area/line chart. series: [{name, color, values[]}], labels: x labels.
 * First series is drawn as area, the rest as lines (same unit, one axis).
 */
export function areaChart(el, { labels, series, height = 240, fmt = fmtNum }) {
  el.classList.add('chart');
  responsive(el, (W) => {
    const H = height, padL = 36, padR = 12, padT = 14, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));

    const n = labels.length;
    const x = (i) => padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => padT + ih - (v / max) * ih;
    const ticks = 4;
    let g = '';
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i;
      g += `<line class="${i === 0 ? 'ax' : 'gl'}" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`;
      g += `<text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" class="num">${esc(fmt(v))}</text>`;
    }
    const step = Math.ceil(n / Math.max(2, Math.floor(iw / 70)));
    labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>`; });
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    let marks = '';
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => [x(i), y(v)]);
      const path = smooth(pts);
      if (si === 0) {
        marks += `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${s.color};stop-opacity:.28"/><stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient></defs>`;
        marks += `<path d="${path} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z" fill="url(#${gid})"/>`;
      }
      marks += `<path d="${path}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linecap="round" ${si > 0 ? 'stroke-dasharray="5 4"' : ''}/>`;
    });
    // end-point direct labels
    series.forEach((s) => {
      const v = s.values[n - 1];
      marks += `<circle cx="${x(n - 1)}" cy="${y(v)}" r="4" style="fill:${s.color};stroke:var(--surface)" stroke-width="2"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${g}${marks}
      <g class="hov" style="display:none"><line class="xh" y1="${padT}" y2="${padT + ih}"/>${series.map((s) => `<circle r="5" style="fill:${s.color};stroke:var(--surface)" stroke-width="2"/>`).join('')}</g>
      <rect class="hit" x="${padL}" y="${padT}" width="${iw}" height="${ih}"/></svg>`;
    const svg = el.querySelector('svg');
    const hov = svg.querySelector('.hov');
    const hit = svg.querySelector('.hit');
    hit.addEventListener('mousemove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - padL) / iw) * (n - 1))));
      hov.style.display = '';
      hov.querySelector('line').setAttribute('x1', x(i));
      hov.querySelector('line').setAttribute('x2', x(i));
      hov.querySelectorAll('circle').forEach((c, si) => { c.setAttribute('cx', x(i)); c.setAttribute('cy', y(series[si].values[i])); });
      showTip(e, tipRows(labels[i], series.map((s) => ({ k: s.name, v: fmt(s.values[i]), color: s.color }))));
    });
    hit.addEventListener('mouseleave', () => { hov.style.display = 'none'; hideTip(); });
  });
}

function smooth(pts) {
  if (pts.length < 3) return 'M' + pts.map((p) => p.join(',')).join(' L');
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    // clamp control points to the segment's y-range so the curve never dips below zero
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    c1[1] = Math.max(lo, Math.min(hi, c1[1]));
    c2[1] = Math.max(lo, Math.min(hi, c2[1]));
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Donut with center total and side legend. items: [{label, value, color}] */
export function donut(el, { items, centerLabel = 'סה״כ', fmt = fmtNum, onClick }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const S = 200, R = 88, r = 62, cx = S / 2, cy = S / 2;
  let a0 = -Math.PI / 2;
  const gap = items.filter((i) => i.value > 0).length > 1 ? 0.025 : 0;
  const arcs = items.map((it, idx) => {
    if (!it.value) return '';
    const a = (it.value / total) * Math.PI * 2;
    const s = a0 + gap / 2, e = a0 + a - gap / 2;
    a0 += a;
    if (a >= Math.PI * 2 - 0.001) {
      return `<g class="mark" data-i="${idx}"><circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" style="stroke:${it.color}" stroke-width="${R - r}"/></g>`;
    }
    const large = e - s > Math.PI ? 1 : 0;
    const p = (rad, ang) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x1, y1] = p(R, s), [x2, y2] = p(R, e), [x3, y3] = p(r, e), [x4, y4] = p(r, s);
    return `<path class="mark" data-i="${idx}" d="M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large} 0 ${x4},${y4} Z" style="fill:${it.color}" ${onClick ? 'cursor="pointer"' : ''}/>`;
  }).join('');
  el.classList.add('donut-wrap');
  el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${S} ${S}" role="img">${total ? arcs : `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" style="stroke:var(--surface-3)" stroke-width="${R - r}"/>`}
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" class="center-v">${esc(fmt(total))}</text>
    <text x="${cx}" y="${cy + 24}" text-anchor="middle" class="center-l">${esc(centerLabel)}</text></svg></div>
    <div class="donut-legend">${items.map((it, i) => `<div class="li" data-i="${i}" ${onClick ? 'style="cursor:pointer"' : ''}><span class="sw" style="width:10px;height:10px;border-radius:3px;background:${it.color}"></span><span>${esc(it.label)}</span><span class="v">${esc(fmt(it.value))}</span><span class="p">${total ? Math.round((it.value / total) * 100) : 0}%</span></div>`).join('')}</div>`;
  const chart = el.querySelector('.chart');
  const hl = (i) => {
    chart.classList.toggle('has-hover', i != null);
    chart.querySelectorAll('.mark').forEach((m) => m.classList.toggle('on', m.dataset.i == i));
  };
  el.querySelectorAll('.mark, .li').forEach((m) => {
    const i = +m.dataset.i;
    m.addEventListener('mousemove', (e) => {
      hl(i);
      const it = items[i];
      showTip(e, tipRows(it.label, [{ k: 'כמות', v: fmt(it.value), color: it.color }, { k: 'שיעור', v: (total ? Math.round((it.value / total) * 100) : 0) + '%' }]));
    });
    m.addEventListener('mouseleave', () => { hl(null); hideTip(); });
    if (onClick) m.addEventListener('click', () => { hideTip(); onClick(items[i], i); });
  });
}

/** Horizontal bars (HTML). items: [{label, value, color, sub}] */
export function hbars(el, { items, fmt = fmtNum, color = 'var(--s1)', max }) {
  const m = max || Math.max(1, ...items.map((i) => i.value));
  el.className = 'hbar';
  el.innerHTML = items.length
    ? items.map((it, i) => `<div class="hbar-row" data-i="${i}"><span class="ellipsis">${esc(it.label)}</span><div class="hbar-track"><div class="hbar-fill" style="width:0;background:${it.color || color}" data-w="${(it.value / m) * 100}"></div></div><span class="v">${esc(fmt(it.value))}</span></div>`).join('')
    : '<div class="muted small">אין נתונים להצגה</div>';
  requestAnimationFrame(() => el.querySelectorAll('.hbar-fill').forEach((f) => (f.style.width = Math.max(1.5, f.dataset.w) + '%')));
  el.querySelectorAll('.hbar-row').forEach((row) => {
    const it = items[+row.dataset.i];
    row.addEventListener('mousemove', (e) => showTip(e, tipRows(it.label, [{ k: it.sub || 'ערך', v: fmt(it.value), color: it.color || color }])));
    row.addEventListener('mouseleave', hideTip);
  });
}

/** Column chart. items: [{label, value}] single series. */
export function columns(el, { items, color = 'var(--s1)', height = 220, fmt = fmtNum, name = 'ערך' }) {
  el.classList.add('chart');
  responsive(el, (W) => {
    const H = height, padL = 40, padR = 8, padT = 18, padB = 30;
    const iw = W - padL - padR, ih = H - padT - padB;
    const max = niceMax(Math.max(1, ...items.map((i) => i.value)));
    const n = items.length || 1;
    const bw = Math.min(42, (iw / n) * 0.62);
    const x = (i) => padL + (iw / n) * (i + 0.5);
    const y = (v) => padT + ih - (v / max) * ih;
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      g += `<line class="${i === 0 ? 'ax' : 'gl'}" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
    }
    const step = Math.ceil(n / Math.max(2, Math.floor(iw / 44)));
    const bars = items.map((it, i) => {
      const h = Math.max(0, y(0) - y(it.value));
      const rr = Math.min(4, h / 2, bw / 2);
      const x0 = x(i) - bw / 2, y0 = y(it.value);
      const d = h > 0 ? `M${x0},${y(0)} V${y0 + rr} Q${x0},${y0} ${x0 + rr},${y0} H${x0 + bw - rr} Q${x0 + bw},${y0} ${x0 + bw},${y0 + rr} V${y(0)} Z` : '';
      return `<g class="mark" data-i="${i}"><path d="${d}" style="fill:${it.color || color}"/>${i % step === 0 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${esc(it.label)}</text>` : ''}<rect class="hit" x="${x(i) - iw / n / 2}" y="${padT}" width="${iw / n}" height="${ih}"/></g>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${g}${bars}</svg>`;
    el.querySelectorAll('.mark').forEach((m) => {
      const it = items[+m.dataset.i];
      m.addEventListener('mousemove', (e) => { el.classList.add('has-hover'); el.querySelectorAll('.mark').forEach((o) => o.classList.toggle('on', o === m)); showTip(e, tipRows(it.label, [{ k: name, v: fmt(it.value), color: it.color || color }])); });
      m.addEventListener('mouseleave', () => { el.classList.remove('has-hover'); hideTip(); });
    });
  });
}

/** Sparkline (no axes) for KPI tiles. */
export function sparkline(values, color = 'var(--accent)') {
  const W = 96, H = 34, n = values.length;
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const pts = values.map((v, i) => [(i / Math.max(1, n - 1)) * (W - 4) + 2, H - 3 - ((v - min) / (max - min || 1)) * (H - 6)]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${smooth(pts)}" fill="none" style="stroke:${color}" stroke-width="2" stroke-linecap="round"/><circle cx="${pts[n - 1][0]}" cy="${pts[n - 1][1]}" r="3" style="fill:${color}"/></svg>`;
}

/** Funnel (HTML). stages: [{label, value, color}] */
export function funnel(el, { stages }) {
  const max = Math.max(1, stages[0]?.value || 1);
  el.className = 'funnel';
  el.innerHTML = stages.map((s, i) => {
    const prev = i ? stages[i - 1].value : null;
    const conv = prev ? Math.round((s.value / prev) * 100) + '%' : '';
    return `<div class="funnel-row" data-i="${i}"><span>${esc(s.label)}</span><div><div class="funnel-bar" style="width:0;background:${s.color}" data-w="${(s.value / max) * 100}">${fmtNum(s.value)}</div></div><span class="conv">${conv ? '← ' + conv : ''}</span></div>`;
  }).join('');
  requestAnimationFrame(() => el.querySelectorAll('.funnel-bar').forEach((b) => (b.style.width = `max(36px, ${b.dataset.w}%)`)));
  el.querySelectorAll('.funnel-row').forEach((row) => {
    const i = +row.dataset.i, s = stages[i];
    row.addEventListener('mousemove', (e) => showTip(e, tipRows(s.label, [
      { k: 'לידים שהגיעו לשלב', v: fmtNum(s.value), color: s.color },
      ...(i ? [{ k: 'המרה מהשלב הקודם', v: (stages[i - 1].value ? Math.round((s.value / stages[i - 1].value) * 100) : 0) + '%' }] : []),
      { k: 'מסך הלידים', v: Math.round((s.value / max) * 100) + '%' },
    ])));
    row.addEventListener('mouseleave', hideTip);
  });
}

export const legend = (items) => `<div class="legend">${items.map((i) => `<span class="li"><span class="sw" style="background:${i.color}"></span>${esc(i.label)}</span>`).join('')}</div>`;
