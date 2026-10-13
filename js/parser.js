// Turns a lead email (raw text, .eml file, or a Gmail message from the sync
// script) into structured lead fields.
import { HORIZONS, GOALS } from './store.js';

const FIELD_LABELS = {
  firstName: ['שם פרטי', 'first name', 'firstname', 'fname'],
  lastName: ['שם משפחה', 'last name', 'lastname', 'surname', 'lname'],
  fullName: ['שם מלא', 'שם הפונה', 'שם הלקוח', 'שם', 'full name', 'name', 'your name'],
  city: ['עיר מגורים', 'עיר', 'יישוב', 'ישוב', 'מקום מגורים', 'city', 'location'],
  phone: ['טלפון נייד', 'טלפון', 'נייד', 'פלאפון', 'סלולרי', 'מספר טלפון', 'phone', 'mobile', 'tel', 'cell'],
  email: ['אימייל', 'דוא"ל', 'דואר אלקטרוני', 'מייל', 'כתובת מייל', 'e-mail', 'email', 'mail'],
  age: ['גיל', 'age'],
  profession: ['מקצוע', 'עיסוק', 'תפקיד', 'occupation', 'profession', 'job'],
  horizon: ['טווח השקעה', 'טווח זמן', 'טווח', 'אופק השקעה', 'horizon', 'investment horizon'],
  goal: ['מטרת ההשקעה', 'מטרת השקעה', 'מטרה', 'goal', 'investment goal', 'purpose'],
  amount: ['סכום השקעה', 'סכום להשקעה', 'סכום', 'הון להשקעה', 'amount', 'investment amount', 'budget'],
  fee: ['דמי ניהול', 'fee', 'management fee'],
  conversation: ['הודעה', 'הערות', 'פרטים נוספים', 'תוכן הפנייה', 'פנייה', 'message', 'comments', 'notes'],
};

// Longest labels first so "שם משפחה" wins over "שם".
const LABEL_INDEX = Object.entries(FIELD_LABELS)
  .flatMap(([field, labels]) => labels.map((l) => ({ field, l: l.toLowerCase() })))
  .sort((a, b) => b.l.length - a.l.length);

const clean = (s) => String(s || '').replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();

export function parseAmount(s) {
  if (s == null) return '';
  let t = String(s).toLowerCase().replace(/[,\s₪$]|ש"ח|שח|nis|ils/g, '');
  let mult = 1;
  if (/(מיליון|מליון|m$|mil)/.test(t)) mult = 1e6;
  else if (/(אלף|k$)/.test(t)) mult = 1e3;
  const m = t.match(/\d+(\.\d+)?/);
  if (!m) return '';
  let v = parseFloat(m[0]) * mult;
  return Math.round(v);
}

function matchOption(value, options) {
  const v = clean(value);
  if (!v) return '';
  const hit = options.find((o) => o === v || v.includes(o) || o.includes(v));
  return hit || v;
}

function mapHorizon(v) {
  const s = clean(v);
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  if (/קצר|short/i.test(s)) return HORIZONS[0];
  if (/ארוך|long/i.test(s)) return HORIZONS[3];
  if (!isNaN(n) && /שנ|year|y/i.test(s)) {
    if (n <= 1) return HORIZONS[0];
    if (n <= 3) return HORIZONS[1];
    if (n <= 5) return HORIZONS[2];
    if (n <= 10) return HORIZONS[3];
    return HORIZONS[4];
  }
  return matchOption(s, HORIZONS);
}

/** Parse a plain-text email body into lead fields. */
export function parseLeadText(text, { excludeEmails = [] } = {}) {
  const out = {};
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const extra = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/^[\s*•\-–|>]+/, '').replace(/\*\*/g, '');
    const m = raw.match(/^([^:：\t|]{1,40}?)\s*[:：\t|]\s*(.*)$/);
    if (!m) { if (clean(raw)) extra.push(clean(raw)); continue; }
    const label = clean(m[1]).toLowerCase().replace(/[?]/g, '');
    let value = m[2].trim();
    // value on the next line ("Name:\nDana")
    if (!value && lines[i + 1] && !/[:：]/.test(lines[i + 1])) { value = lines[i + 1].trim(); i++; }
    const hit = LABEL_INDEX.find((x) => label === x.l || label.endsWith(' ' + x.l) || label.startsWith(x.l + ' ') || label === x.l + 'ה');
    if (!hit) { if (clean(raw)) extra.push(clean(raw)); continue; }
    if (out[hit.field] == null || out[hit.field] === '') out[hit.field] = value;
    else if (hit.field === 'conversation') out.conversation += '\n' + value;
  }
  const body = String(text || '');
  if (out.fullName && !out.firstName) {
    const parts = clean(out.fullName).split(' ');
    out.firstName = parts.shift() || '';
    if (!out.lastName) out.lastName = parts.join(' ');
  }
  delete out.fullName;
  const ex = excludeEmails.map((e) => e.toLowerCase());
  if (!out.email) {
    const emails = (body.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).filter((e) => !ex.includes(e.toLowerCase()));
    if (emails.length) out.email = emails[0];
  } else {
    const m = out.email.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    out.email = m ? m[0] : clean(out.email);
  }
  if (!out.phone) {
    const m = body.match(/(?:\+?972[-\s]?|0)5\d[-\s]?\d{3}[-\s]?\d{4}/);
    if (m) out.phone = m[0];
  }
  if (out.phone) out.phone = clean(out.phone).replace(/[^\d+\-\s]/g, '').trim();
  if (out.age) out.age = parseInt(String(out.age).replace(/\D/g, ''), 10) || '';
  if (out.amount != null) out.amount = parseAmount(out.amount);
  if (out.fee != null) { const f = parseFloat(String(out.fee).replace(/[^\d.]/g, '')); out.fee = isNaN(f) ? '' : f; }
  if (out.horizon) out.horizon = mapHorizon(out.horizon);
  if (out.goal) out.goal = matchOption(out.goal, GOALS);
  ['firstName', 'lastName', 'city', 'profession'].forEach((k) => { if (out[k]) out[k] = clean(out[k]); });
  if (!out.conversation && extra.length) out.conversation = extra.filter((l) => !/^(--|sent from|נשלח מ)/i.test(l)).slice(0, 12).join('\n');
  Object.keys(out).forEach((k) => (out[k] === '' || out[k] == null) && delete out[k]);
  return out;
}

/* ---------- .eml (RFC 822 / MIME) ---------- */
function decodeBytes(bytes, charset) {
  try { return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); }
}
function b64bytes(s) {
  const bin = atob(s.replace(/[^A-Za-z0-9+/=]/g, ''));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function qpBytes(s) {
  s = s.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
    else {
      const c = s.charCodeAt(i);
      if (c < 128) out.push(c); else out.push(...new TextEncoder().encode(s[i]));
    }
  }
  return new Uint8Array(out);
}
export function decodeWords(s) {
  return String(s || '').replace(/(\?=)\s+(?==\?)/g, '$1').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, cs, enc, txt) =>
    decodeBytes(enc.toUpperCase() === 'B' ? b64bytes(txt) : qpBytes(txt.replace(/_/g, ' ')), cs));
}
function splitHeaders(raw) {
  const idx = raw.search(/\r?\n\r?\n/);
  const head = idx < 0 ? raw : raw.slice(0, idx);
  const body = idx < 0 ? '' : raw.slice(idx).replace(/^\r?\n\r?\n/, '');
  const headers = {};
  head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2];
  });
  return { headers, body };
}
function param(h, name) {
  const m = String(h || '').match(new RegExp(name + '="?([^";]+)"?', 'i'));
  return m ? m[1] : '';
}
function decodePart(headers, body) {
  const cte = (headers['content-transfer-encoding'] || '').toLowerCase();
  const cs = param(headers['content-type'], 'charset') || 'utf-8';
  if (cte === 'base64') return decodeBytes(b64bytes(body), cs);
  if (cte === 'quoted-printable') return decodeBytes(qpBytes(body), cs);
  return body;
}
function walk(headers, body, acc) {
  const ct = (headers['content-type'] || 'text/plain').toLowerCase();
  if (ct.startsWith('multipart/')) {
    const b = param(headers['content-type'], 'boundary');
    if (!b) return;
    body.split('--' + b).slice(1).forEach((part) => {
      if (part.startsWith('--')) return;
      const p = splitHeaders(part.replace(/^\r?\n/, ''));
      walk(p.headers, p.body, acc);
    });
  } else if (ct.startsWith('text/plain') && !/attachment/i.test(headers['content-disposition'] || '')) {
    acc.text = acc.text || decodePart(headers, body);
  } else if (ct.startsWith('text/html')) {
    acc.html = acc.html || decodePart(headers, body);
  }
}
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(String(html).replace(/<(br|\/p|\/div|\/tr|\/li|\/h\d)[^>]*>/gi, '$&\n').replace(/<\/t[dh]>/gi, '$&\t'), 'text/html');
  return (doc.body.textContent || '').replace(/\t+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function parseEml(raw) {
  const { headers, body } = splitHeaders(raw);
  const acc = {};
  walk(headers, body, acc);
  const text = acc.text || (acc.html ? htmlToText(acc.html) : body);
  return {
    from: decodeWords(headers.from || ''),
    subject: decodeWords(headers.subject || ''),
    date: headers.date ? new Date(headers.date).toISOString() : new Date().toISOString(),
    messageId: headers['message-id'] || '',
    body: text.trim(),
  };
}
export const emailAddr = (from) => (String(from).match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0].toLowerCase();
