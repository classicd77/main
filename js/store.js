// Application state: leads, settings, templates, email log, inbox (localStorage)
// and marketing files (IndexedDB, since they can be large binary blobs).
import { uid, normPhone, toISODate } from './util.js';

const KEY = 'crm.v1';

export const STATUSES = [
  { id: 'new', label: 'חדש', color: 'var(--s1)' },
  { id: 'contacted', label: 'נוצר קשר', color: 'var(--s2)' },
  { id: 'meeting', label: 'פגישה נקבעה', color: 'var(--s3)' },
  { id: 'proposal', label: 'הצעה נשלחה', color: 'var(--s4)' },
  { id: 'negotiation', label: 'משא ומתן', color: 'var(--s5)' },
  { id: 'won', label: 'נסגר – לקוח', color: 'var(--s6)' },
  { id: 'lost', label: 'לא רלוונטי', color: 'var(--s8)' },
];
export const PIPELINE = STATUSES.filter((s) => s.id !== 'lost');
export const statusById = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
export const stageIndex = (id) => PIPELINE.findIndex((s) => s.id === id);

export const HORIZONS = ['עד שנה', '1–3 שנים', '3–5 שנים', '5–10 שנים', 'מעל 10 שנים'];
export const GOALS = ['צמיחת הון', 'שימור הון', 'הכנסה פסיבית', 'חיסכון לפרישה', 'חיסכון לילדים', 'רכישת נדל"ן', 'נזילות וגמישות', 'אחר'];
export const SOURCES = ['מייל', 'ידני', 'הפניה', 'אתר', 'רשתות חברתיות', 'אירוע', 'אחר'];
export const PRIORITIES = [
  { id: 'high', label: 'גבוהה' },
  { id: 'med', label: 'בינונית' },
  { id: 'low', label: 'נמוכה' },
];
export const ACTIVITY_TYPES = {
  note: { label: 'הערה', icon: 'note' },
  call: { label: 'שיחה', icon: 'phone' },
  meeting: { label: 'פגישה', icon: 'meeting' },
  email: { label: 'מייל', icon: 'mail' },
  status: { label: 'שינוי סטטוס', icon: 'flag' },
  created: { label: 'נוצר', icon: 'sparkle' },
  whatsapp: { label: 'וואטסאפ', icon: 'whatsapp' },
};
export const FILE_CATEGORIES = ['מצגות', 'תמצית מנהלים', 'ברושורים', 'דוחות ומחקרים', 'טפסים והסכמים', 'אחר'];
export const FOLDER_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#c9a24a', '#e87ba4', '#008300', '#6250d6', '#e34948', '#898781'];

export const WIDGETS = [
  { id: 'hero', label: 'כרטיס פתיחה ושווי צנרת' },
  { id: 'kpis', label: 'מדדי מפתח (KPI)' },
  { id: 'trend', label: 'מגמת לידים לאורך זמן' },
  { id: 'status', label: 'פילוח לפי סטטוס' },
  { id: 'funnel', label: 'משפך המרה' },
  { id: 'followups', label: 'מעקבים קרובים' },
  { id: 'recent', label: 'לידים אחרונים' },
  { id: 'goals', label: 'מטרות השקעה' },
  { id: 'sources', label: 'מקורות לידים' },
  { id: 'activity', label: 'פעילות אחרונה' },
];

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-intro',
    name: 'פנייה ראשונית',
    subject: 'שמחתי לשוחח, {{שם פרטי}} – המשך התהליך',
    body:
      'שלום {{שם פרטי}},\n\nתודה על פנייתך ועל הזמן שהקדשת לשיחה. כפי שסיכמנו, אשמח לבנות עבורך תכנית השקעה המותאמת למטרה שלך – {{מטרה}} – בטווח של {{טווח}}.\n\nמצורפת מצגת היכרות קצרה על בית ההשקעות. אשמח לקבוע פגישת המשך בזמן שנוח לך.\n\nבברכה,\n{{יועץ}}\n{{חברה}} | {{טלפון יועץ}}',
  },
  {
    id: 'tpl-proposal',
    name: 'הצעת ניהול תיק',
    subject: 'הצעה לניהול תיק השקעות – {{שם פרטי}} {{שם משפחה}}',
    body:
      'שלום {{שם פרטי}},\n\nבהמשך לפגישתנו, להלן עיקרי ההצעה:\n\n• סכום השקעה: {{סכום}}\n• דמי ניהול שנתיים: {{דמי ניהול}}\n• מטרת ההשקעה: {{מטרה}}\n• טווח השקעה: {{טווח}}\n\nאשמח לענות על כל שאלה ולהתקדם לחתימה.\n\nבברכה,\n{{יועץ}}\n{{חברה}}',
  },
  {
    id: 'tpl-followup',
    name: 'תזכורת מעקב',
    subject: 'רציתי לבדוק מה שלומך, {{שם פרטי}}',
    body: 'היי {{שם פרטי}},\n\nרציתי לבדוק אם היה לך זמן לעבור על החומרים ששלחתי, ואם יש שאלות שאוכל לעזור בהן.\n\nזמין עבורך בכל עת,\n{{יועץ}}\n{{טלפון יועץ}}',
  },
];

const DEFAULT_FOLDERS = [
  { id: 'f-private', name: 'לקוחות פרטיים', color: '#2a78d6' },
  { id: 'f-qualified', name: 'משקיעים כשירים', color: '#c9a24a' },
  { id: 'f-business', name: 'חברות ועסקים', color: '#1baf7a' },
  { id: 'f-pension', name: 'פרישה ופנסיה', color: '#6250d6' },
];

function defaults() {
  return {
    version: 1,
    leads: [],
    folders: DEFAULT_FOLDERS,
    templates: DEFAULT_TEMPLATES,
    emails: [],
    inbox: [],
    settings: {
      advisorName: '',
      company: '',
      advisorPhone: '',
      leadSourceEmail: '',
      leadSubjectFilter: '',
      scriptUrl: '',
      scriptToken: '',
      autoSyncMin: 0,
      sendMode: 'mailto',
      defaultFee: 0.8,
      widgets: WIDGETS.map((w) => w.id),
      lastSync: 0,
      processedIds: [],
      followUpDays: 3,
    },
    demo: false,
  };
}

export const state = load();

function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  const d = defaults();
  if (!s) return d;
  return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
}

const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error(e);
  }
  listeners.forEach((fn) => fn());
}
export function replaceState(next) {
  const d = defaults();
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, d, next, { settings: { ...d.settings, ...(next.settings || {}) } });
  save();
}
export const resetState = () => replaceState(defaults());

/* ---------- Leads ---------- */
export function blankLead(extra = {}) {
  return {
    id: uid(),
    firstName: '',
    lastName: '',
    city: '',
    phone: '',
    email: '',
    age: '',
    profession: '',
    horizon: '',
    goal: '',
    amount: '',
    fee: state.settings.defaultFee ?? '',
    conversation: '',
    status: 'new',
    maxStage: 0,
    priority: 'med',
    source: 'ידני',
    folderId: '',
    tags: [],
    nextFollowUp: '',
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activities: [],
    ...extra,
  };
}

export const fullName = (l) => `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'ללא שם';
export const getLead = (id) => state.leads.find((l) => l.id === id);
export const activeLeads = () => state.leads.filter((l) => !l.archived);

export function addActivity(lead, type, text, at) {
  lead.activities.unshift({ id: uid(), type, text, at: at || new Date().toISOString() });
}

export function createLead(data, { source = 'ידני', note } = {}) {
  const lead = blankLead({ source, ...data });
  if (!lead.nextFollowUp && state.settings.followUpDays) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    lead.nextFollowUp = toISODate(d);
  }
  addActivity(lead, 'created', note || `ליד נוצר (${source})`);
  state.leads.unshift(lead);
  save();
  return lead;
}

export function updateLead(lead, patch) {
  if (patch.status && patch.status !== lead.status) {
    addActivity(lead, 'status', `סטטוס שונה: ${statusById(lead.status).label} ← ${statusById(patch.status).label}`);
    const si = stageIndex(patch.status);
    if (si > (lead.maxStage || 0)) patch.maxStage = si;
    if (patch.status === 'won') patch.wonAt = new Date().toISOString();
    if (['won', 'lost'].includes(patch.status) && !('nextFollowUp' in patch)) patch.nextFollowUp = '';
  }
  Object.assign(lead, patch, { updatedAt: new Date().toISOString() });
  save();
}

export function deleteLeads(ids) {
  const set = new Set(ids);
  state.leads = state.leads.filter((l) => !set.has(l.id));
  save();
}

export function findDuplicate({ email, phone }) {
  const e = (email || '').trim().toLowerCase();
  const p = normPhone(phone);
  return state.leads.find((l) => (e && (l.email || '').toLowerCase() === e) || (p && p.length >= 9 && normPhone(l.phone) === p));
}

export function leadScore(l) {
  // 0–100 heuristic: size of the deal, how far along, reachability and freshness.
  const amt = Number(l.amount) || 0;
  let s = 0;
  s += Math.min(35, (Math.log10(Math.max(amt, 1)) - 4) * 14); // 10K→0 … 1M→28 … 3M+→35
  s += [8, 14, 20, 26, 30, 35, 0][STATUSES.findIndex((x) => x.id === l.status)] || 0;
  if (l.phone) s += 6;
  if (l.email) s += 4;
  if (l.goal && l.horizon) s += 5;
  const last = l.activities[0]?.at || l.updatedAt;
  const days = (Date.now() - new Date(last)) / 864e5;
  s += days < 3 ? 15 : days < 10 ? 10 : days < 30 ? 4 : 0;
  if (l.status === 'lost') s = Math.min(s, 10);
  return Math.max(0, Math.min(100, Math.round(s)));
}

/* ---------- Template rendering ---------- */
export function renderTemplate(text, lead) {
  const st = state.settings;
  const map = {
    'שם פרטי': lead?.firstName,
    'שם משפחה': lead?.lastName,
    'שם מלא': lead ? fullName(lead) : '',
    'עיר': lead?.city,
    'סכום': lead?.amount ? '₪' + Number(lead.amount).toLocaleString('he-IL') : '',
    'דמי ניהול': lead?.fee !== '' && lead?.fee != null ? lead.fee + '%' : '',
    'מטרה': lead?.goal,
    'טווח': lead?.horizon,
    'יועץ': st.advisorName,
    'חברה': st.company,
    'טלפון יועץ': st.advisorPhone,
  };
  return String(text || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, k) => (k in map ? map[k] || '' : m));
}
export const TEMPLATE_VARS = ['שם פרטי', 'שם משפחה', 'שם מלא', 'עיר', 'סכום', 'דמי ניהול', 'מטרה', 'טווח', 'יועץ', 'חברה', 'טלפון יועץ'];

/* ---------- Files (IndexedDB) ---------- */
let dbp;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('crm-files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('files', mode);
    const out = fn(t.objectStore('files'));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}
export const files = {
  async all() {
    const d = await db();
    return new Promise((res, rej) => {
      const r = d.transaction('files').objectStore('files').getAll();
      r.onsuccess = () => res(r.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      r.onerror = () => rej(r.error);
    });
  },
  async get(id) {
    const d = await db();
    return new Promise((res, rej) => {
      const r = d.transaction('files').objectStore('files').get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  put: (rec) => tx('readwrite', (s) => s.put(rec)),
  remove: (id) => tx('readwrite', (s) => s.delete(id)),
};

/* ---------- Demo data ---------- */
export function seedDemo() {
  const first = ['דניאל', 'מיכל', 'יוסי', 'נועה', 'אבי', 'רונית', 'עומר', 'שירה', 'איתי', 'טל', 'גלית', 'אריאל', 'יעל', 'משה', 'הילה', 'עידו', 'ליאת', 'רועי', 'אורית', 'אלון', 'מאיה', 'דוד', 'ענבל', 'גיא', 'סיגל', 'ניר', 'קרן', 'אסף', 'לימור', 'אמיר', 'רחל', 'ברק', 'תמר', 'שי', 'אילנה', 'יונתן'];
  const last = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'גולדברג', 'אזולאי', 'רוזן', 'דהן', 'חדד', 'קפלן', 'ברגר', 'וייס', 'אלון', 'נחום'];
  const cities = ['תל אביב', 'ירושלים', 'חיפה', 'רמת גן', 'הרצליה', 'רעננה', 'כפר סבא', 'מודיעין', 'באר שבע', 'פתח תקווה', 'ראשון לציון', 'נתניה', 'הוד השרון'];
  const profs = ['עורך/ת דין', 'רופא/ה', 'מהנדס/ת תוכנה', 'רואה חשבון', 'יזם/ית', 'מנהל/ת מוצר', 'אדריכל/ית', 'בעל/ת עסק', 'פנסיונר/ית', 'טייס/ת', 'יועץ/ת ארגוני/ת', 'רוקח/ת'];
  const convs = [
    'מעוניין/ת בפיזור ההשקעות מחוץ לבנק. כרגע הכסף בפיקדון. שאל/ה על רמת סיכון ונזילות.',
    'קיבל/ה ירושה ומחפש/ת לשמר את ההון. רגיש/ה לדמי ניהול, השווה/תה מול 2 גופים נוספים.',
    'מכר/ה דירה ורוצה תשואה עודפת על המדד. מעדיף/ה תיק מנייתי עם חשיפה לחו"ל.',
    'חוסך/ת לפרישה בעוד כ-10 שנים. ביקש/ה לקבל מצגת ותמצית מנהלים במייל.',
    'בעל/ת עסק, מחפש/ת השקעה סולידית לעודפי מזומן של החברה. החלטה משותפת עם רו"ח.',
    'הגיע/ה דרך המלצה של לקוח קיים. מאוד מעוניין/ת, ביקש/ה לקבוע פגישה בשבוע הבא.',
  ];
  const tagsPool = ['VIP', 'הפניה', 'חם', 'השוואת מחירים', 'חו"ל', 'מסלול סולידי'];
  const statusW = ['new', 'new', 'new', 'contacted', 'contacted', 'contacted', 'meeting', 'meeting', 'proposal', 'proposal', 'negotiation', 'won', 'won', 'won', 'lost', 'lost'];
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const leads = [];
  for (let i = 0; i < 46; i++) {
    const created = new Date(Date.now() - Math.pow(Math.random(), 1.4) * 150 * 864e5);
    const status = rnd(statusW);
    const amount = rnd([150, 250, 300, 400, 500, 750, 1000, 1200, 1500, 2000, 3000, 5000]) * 1000;
    const fee = amount >= 2000000 ? rnd([0.5, 0.6, 0.7]) : amount >= 800000 ? rnd([0.7, 0.8, 0.9]) : rnd([0.9, 1, 1.1, 1.2]);
    const fn = first[i % first.length];
    const ln = rnd(last);
    const follow = new Date(Date.now() + (Math.floor(Math.random() * 14) - 4) * 864e5);
    const l = blankLead({
      firstName: fn,
      lastName: ln,
      city: rnd(cities),
      phone: '05' + rnd(['0', '2', '3', '4', '8']) + '-' + String(Math.floor(1000000 + Math.random() * 8999999)),
      email: `demo${i + 1}@example.com`,
      age: 28 + Math.floor(Math.random() * 42),
      profession: rnd(profs),
      horizon: rnd(HORIZONS),
      goal: rnd(GOALS),
      amount,
      fee,
      conversation: rnd(convs),
      status,
      maxStage: status === 'lost' ? Math.floor(Math.random() * 4) : stageIndex(status),
      priority: amount >= 1500000 ? 'high' : rnd(['med', 'med', 'low', 'high']),
      source: rnd(['מייל', 'מייל', 'מייל', 'הפניה', 'אתר', 'ידני', 'רשתות חברתיות', 'אירוע']),
      folderId: rnd([...DEFAULT_FOLDERS.map((f) => f.id), '', '']),
      tags: Math.random() < 0.5 ? [rnd(tagsPool)] : [],
      nextFollowUp: ['won', 'lost'].includes(status) ? '' : toISODate(follow),
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      demo: true,
    });
    const acts = [];
    acts.push({ id: uid(), type: 'created', text: `ליד נוצר (${l.source})`, at: created.toISOString() });
    let t = created.getTime();
    const steps = status === 'lost' ? l.maxStage : stageIndex(status);
    for (let s = 1; s <= steps; s++) {
      t += (1 + Math.random() * 6) * 864e5;
      if (t > Date.now()) t = Date.now() - Math.random() * 864e5;
      acts.push({ id: uid(), type: s === 2 ? 'meeting' : 'call', text: s === 1 ? 'שיחת היכרות ראשונה' : s === 2 ? 'פגישה במשרד' : 'שיחת המשך', at: new Date(t).toISOString() });
      acts.push({ id: uid(), type: 'status', text: `סטטוס שונה ← ${PIPELINE[s].label}`, at: new Date(t + 60000).toISOString() });
    }
    if (status === 'lost') acts.push({ id: uid(), type: 'status', text: 'סטטוס שונה ← לא רלוונטי', at: new Date(Math.min(t + 3 * 864e5, Date.now())).toISOString() });
    l.activities = acts.sort((a, b) => b.at.localeCompare(a.at));
    l.updatedAt = l.activities[0].at;
    if (status === 'won') l.wonAt = l.updatedAt;
    leads.push(l);
  }
  state.leads = [...leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), ...state.leads];
  state.demo = true;
  if (!state.settings.advisorName) state.settings.advisorName = 'שם היועץ';
  if (!state.settings.company) state.settings.company = 'בית השקעות';
  save();
}
export function clearDemo() {
  state.leads = state.leads.filter((l) => !l.demo);
  state.demo = false;
  save();
}
