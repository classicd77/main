// Email in/out: the Google Apps Script bridge (sync leads from Gmail, send mail
// with attachments), plus mailto / Gmail-compose fallbacks that need no setup.
import { state, save, addActivity, findDuplicate } from './store.js';
import { parseLeadText, emailAddr } from './parser.js';
import { uid } from './util.js';

export const APPS_SCRIPT = `/**
 * LeadFlow CRM – גשר Gmail
 * 1. פתחו https://script.google.com ← פרויקט חדש, והדביקו את הקוד.
 * 2. שנו את TOKEN לסיסמה ארוכה משלכם (אותה סיסמה תוזן בהגדרות ה-CRM).
 * 3. Deploy ← New deployment ← Web app:
 *    Execute as: Me | Who has access: Anyone
 * 4. העתיקו את כתובת ה-Web app (מסתיימת ב-/exec) להגדרות ה-CRM.
 */
const TOKEN = 'CHANGE-ME-TO-A-LONG-SECRET';

function doGet(e) {
  const p = e.parameter || {};
  if (p.token !== TOKEN) return json({ error: 'unauthorized' });
  if (!p.from) return json({ error: 'missing from' });
  const since = Number(p.since || 0);
  let q = 'from:(' + p.from + ')';
  if (p.subject) q += ' subject:(' + p.subject + ')';
  if (since) q += ' after:' + Math.floor(since / 1000);
  else q += ' newer_than:30d';
  const out = [];
  GmailApp.search(q, 0, 50).forEach(function (t) {
    t.getMessages().forEach(function (m) {
      if (m.getDate().getTime() <= since) return;
      if (m.getFrom().toLowerCase().indexOf(p.from.toLowerCase()) < 0) return;
      out.push({ id: m.getId(), from: m.getFrom(), subject: m.getSubject(),
                 date: m.getDate().toISOString(), body: m.getPlainBody() });
    });
  });
  return json({ messages: out });
}

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.token !== TOKEN) return json({ error: 'unauthorized' });
  const opts = { name: d.fromName || undefined, htmlBody: d.html };
  if (d.attachments && d.attachments.length) {
    opts.attachments = d.attachments.map(function (a) {
      return Utilities.newBlob(Utilities.base64Decode(a.data), a.type, a.name);
    });
  }
  GmailApp.sendEmail(d.to, d.subject, d.text, opts);
  return json({ ok: true });
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export const scriptReady = () => !!(state.settings.scriptUrl && state.settings.scriptToken);

/** Pull new messages from the configured sender into the inbox queue. */
export async function syncInbox() {
  const st = state.settings;
  if (!st.leadSourceEmail) throw new Error('יש להגדיר כתובת מייל של מקור הלידים בהגדרות');
  if (!scriptReady()) throw new Error('יש להגדיר את גשר ה-Gmail (כתובת סקריפט וטוקן) בהגדרות');
  const url = new URL(st.scriptUrl);
  url.searchParams.set('token', st.scriptToken);
  url.searchParams.set('from', st.leadSourceEmail);
  if (st.leadSubjectFilter) url.searchParams.set('subject', st.leadSubjectFilter);
  if (st.lastSync) url.searchParams.set('since', String(st.lastSync - 60000));
  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error('שגיאת תקשורת: ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error === 'unauthorized' ? 'הטוקן שגוי' : data.error);
  const added = ingest(data.messages || [], 'gmail');
  st.lastSync = Date.now();
  save();
  return added;
}

/** Add raw messages to the inbox, skipping ones already seen. */
export function ingest(messages) {
  const seen = new Set(state.settings.processedIds);
  let added = 0;
  const exclude = [state.settings.leadSourceEmail, emailAddr(state.settings.leadSourceEmail)].filter(Boolean);
  for (const m of messages) {
    const key = m.id || m.messageId || (m.subject + m.date);
    if (seen.has(key)) continue;
    seen.add(key);
    const parsed = parseLeadText(m.body, { excludeEmails: [...exclude, emailAddr(m.from)] });
    state.inbox.unshift({
      id: uid(),
      key,
      from: m.from || '',
      subject: m.subject || '',
      date: m.date || new Date().toISOString(),
      body: m.body || '',
      parsed,
      dup: findDuplicate(parsed)?.id || '',
      status: 'pending',
    });
    added++;
  }
  state.settings.processedIds = [...seen].slice(-2000);
  save();
  return added;
}

const toHtml = (text) =>
  '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">' +
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') +
  '</div>';

/**
 * Send an email. mode: 'script' (real send, supports attachments),
 * 'gmail' (opens Gmail compose), 'mailto' (default mail app).
 */
export async function sendEmail({ to, subject, body, attachments = [], leads = [], mode }) {
  mode = mode || state.settings.sendMode;
  if (mode === 'script') {
    if (!scriptReady()) throw new Error('גשר ה-Gmail לא מוגדר');
    const res = await fetch(state.settings.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: state.settings.scriptToken, to, subject, text: body, html: toHtml(body), fromName: state.settings.advisorName, attachments }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || 'השליחה נכשלה');
  } else if (mode === 'gmail') {
    const u = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(u, '_blank', 'noopener');
  } else {
    window.location.href = `mailto:${encodeURIComponent(to).replace(/%40/g, '@').replace(/%2C/g, ',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const at = new Date().toISOString();
  state.emails.unshift({ id: uid(), to, subject, body, at, mode, leadIds: leads.map((l) => l.id), attachments: attachments.map((a) => a.name) });
  leads.forEach((l) => { addActivity(l, 'email', `נשלח מייל: ${subject}`, at); l.updatedAt = at; });
  save();
}
