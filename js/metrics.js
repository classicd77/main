// Aggregations shared by the dashboard and reports.
import { STATUSES, PIPELINE, stageIndex } from './store.js';
import { startOfDay } from './util.js';

export const isOpen = (l) => !['won', 'lost'].includes(l.status);
export const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const feeRevenue = (l) => ((Number(l.amount) || 0) * (Number(l.fee) || 0)) / 100;

export function inRange(leads, from, to, key = 'createdAt') {
  return leads.filter((l) => {
    const t = new Date(l[key]).getTime();
    return (!from || t >= from) && (!to || t <= to);
  });
}

export function conversion(leads) {
  const closed = leads.filter((l) => l.status === 'won' || l.status === 'lost').length;
  const won = leads.filter((l) => l.status === 'won').length;
  return { won, closed, rate: leads.length ? (won / leads.length) * 100 : 0, closeRate: closed ? (won / closed) * 100 : 0 };
}

/** Bucket counts per week (or day/month) over the last n periods. */
export function buckets(leads, { n = 12, unit = 'week', key = 'createdAt', end = Date.now(), value = () => 1 } = {}) {
  const out = [];
  const endD = startOfDay(end);
  for (let i = n - 1; i >= 0; i--) {
    let s, e, label;
    if (unit === 'month') {
      s = new Date(endD.getFullYear(), endD.getMonth() - i, 1);
      e = new Date(endD.getFullYear(), endD.getMonth() - i + 1, 1);
      label = s.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
    } else {
      const len = unit === 'day' ? 1 : 7;
      e = new Date(endD.getTime() + 864e5 - i * len * 864e5);
      s = new Date(e.getTime() - len * 864e5);
      label = s.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
    }
    out.push({ label, s: s.getTime(), e: e.getTime(), v: 0 });
  }
  leads.forEach((l) => {
    if (!l[key]) return;
    const t = new Date(l[key]).getTime();
    const b = out.find((x) => t >= x.s && t < x.e);
    if (b) b.v += value(l);
  });
  return out;
}

export function byStatus(leads) {
  return STATUSES.map((s) => ({ id: s.id, label: s.label, color: s.color, value: leads.filter((l) => l.status === s.id).length }));
}

export function funnelStages(leads) {
  return PIPELINE.map((s, i) => ({
    label: s.label,
    color: s.color,
    value: leads.filter((l) => Math.max(l.maxStage || 0, stageIndex(l.status)) >= i).length,
  }));
}

export function groupBy(leads, key, { value = () => 1, top = 8, other = 'אחר', empty = 'לא צוין' } = {}) {
  const m = new Map();
  leads.forEach((l) => {
    const k = (typeof key === 'function' ? key(l) : l[key]) || empty;
    m.set(k, (m.get(k) || 0) + value(l));
  });
  let arr = [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  if (arr.length > top) {
    const head = arr.slice(0, top - 1);
    const rest = arr.slice(top - 1).reduce((a, b) => a + b.value, 0);
    const same = head.find((x) => x.label === other); // fold into an existing "אחר" bucket
    if (same) same.value += rest;
    arr = same ? head : [...head, { label: other, value: rest }];
    arr.sort((a, b) => b.value - a.value);
  }
  return arr;
}

export function ageBand(age) {
  const a = Number(age);
  if (!a) return '';
  if (a < 30) return 'עד 30';
  if (a < 40) return '30–39';
  if (a < 50) return '40–49';
  if (a < 60) return '50–59';
  if (a < 70) return '60–69';
  return '70 ומעלה';
}
export function amountBand(v) {
  const a = Number(v);
  if (!a) return '';
  if (a < 250000) return 'עד 250K';
  if (a < 500000) return '250K–500K';
  if (a < 1000000) return '500K–1M';
  if (a < 2500000) return '1M–2.5M';
  return 'מעל 2.5M';
}
export const AGE_ORDER = ['עד 30', '30–39', '40–49', '50–59', '60–69', '70 ומעלה'];
export const AMOUNT_ORDER = ['עד 250K', '250K–500K', '500K–1M', '1M–2.5M', 'מעל 2.5M'];
