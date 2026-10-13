import { files, FILE_CATEGORIES } from '../store.js';
import { esc, icon, fmtSize, fmtDate, openModal, confirmDialog, toast, downloadBlob, uid, $, $$ } from '../util.js';
import { openComposer, fileExt, fileColor } from '../components.js';

let cat = '';
let q = '';
let urls = [];
const MAX = 25 * 1024 * 1024;

export async function render(view) {
  const all = await files.all();
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  const list = all.filter((f) => (!cat || f.category === cat) && (!q || (f.name + ' ' + (f.description || '')).toLowerCase().includes(q.toLowerCase())));
  const total = all.reduce((a, f) => a + f.size, 0);
  const counts = Object.fromEntries(FILE_CATEGORIES.map((c) => [c, all.filter((f) => f.category === c).length]));

  view.innerHTML = `
    <div class="page-head"><div><h1>קבצים שיווקיים</h1><div class="sub">${all.length} קבצים · ${fmtSize(total)} · מצגות, תמציות מנהלים, ברושורים ועוד</div></div></div>
    <label class="dropzone" id="fDrop" style="display:block;margin-bottom:18px">
      <div class="big">${icon('upload')}</div>
      <div><b>גררו קבצים לכאן</b> או לחצו להעלאה ${cat ? `לקטגוריה <b>${esc(cat)}</b>` : ''}</div>
      <div class="small">PDF, PowerPoint, Word, Excel, תמונות ווידאו · עד 25MB לקובץ · נשמר מקומית בדפדפן</div>
      <input type="file" id="fInput" multiple hidden>
    </label>
    <div class="toolbar">
      <div class="chips"><button class="chip ${!cat ? 'on' : ''}" data-cat="">הכל<span class="c">${all.length}</span></button>${FILE_CATEGORIES.map((c) => `<button class="chip ${cat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}<span class="c">${counts[c]}</span></button>`).join('')}</div>
      <span class="spacer"></span>
      <div class="search" style="max-width:240px"><span>${icon('search')}</span><input id="fq" type="search" placeholder="חיפוש קובץ…" value="${esc(q)}"></div>
    </div>
    ${list.length ? `<div class="file-grid">${list.map((f) => {
      let thumb = `<span class="ext">${esc(fileExt(f.name) || 'FILE')}</span>`;
      if ((f.type || '').startsWith('image/')) { const u = URL.createObjectURL(f.blob); urls.push(u); thumb = `<img src="${u}" alt="">`; }
      return `<div class="file-card">
        <div class="file-thumb" style="background:${fileColor(f.name)}" data-view="${f.id}">${thumb}</div>
        <div class="file-body"><div class="nm">${esc(f.name)}</div>
          <div class="row wrap small muted"><span class="tag">${esc(f.category)}</span>${fmtSize(f.size)} · ${fmtDate(f.createdAt)}</div>
          ${f.description ? `<div class="small ink2">${esc(f.description)}</div>` : ''}</div>
        <div class="file-foot">
          <button class="icon-btn sm" data-view="${f.id}" title="תצוגה">${icon('eye')}</button>
          <button class="icon-btn sm" data-dl="${f.id}" title="הורדה">${icon('download')}</button>
          <button class="icon-btn sm" data-send="${f.id}" title="שליחה במייל">${icon('send')}</button>
          <button class="icon-btn sm" data-edit="${f.id}" title="עריכה">${icon('edit')}</button>
          <span class="spacer"></span>
          <button class="icon-btn sm danger" data-del="${f.id}" title="מחיקה">${icon('trash')}</button>
        </div></div>`;
    }).join('')}</div>` : `<div class="card"><div class="empty"><div class="big">${icon('folder')}</div><h3>${all.length ? 'לא נמצאו קבצים' : 'הספרייה ריקה'}</h3><div>העלו מצגות, תמציות מנהלים וחומרים שיווקיים כדי לשלוח אותם ללידים בקליק</div></div></div>`}`;

  const get = (id) => all.find((f) => f.id === id);
  const upload = async (fl) => {
    let n = 0;
    for (const file of fl) {
      if (file.size > MAX) { toast(`${file.name} גדול מדי (מעל 25MB)`, 'err'); continue; }
      await files.put({ id: uid(), name: file.name, type: file.type, size: file.size, category: cat || guessCat(file.name), description: '', createdAt: new Date().toISOString(), blob: file });
      n++;
    }
    if (n) toast(`הועלו ${n} קבצים`);
    render(view);
  };
  const drop = $('#fDrop', view), inp = $('#fInput', view);
  inp.addEventListener('change', () => upload([...inp.files]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upload([...e.dataTransfer.files]); });
  $$('[data-cat]', view).forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat; render(view); }));
  const fq = $('#fq', view);
  fq.addEventListener('input', () => { q = fq.value; clearTimeout(fq._t); fq._t = setTimeout(async () => { await render(view); const n = $('#fq', view); n.focus(); n.selectionStart = n.value.length; }, 200); });
  $$('[data-dl]', view).forEach((b) => b.addEventListener('click', () => { const f = get(b.dataset.dl); downloadBlob(f.blob, f.name); }));
  $$('[data-send]', view).forEach((b) => b.addEventListener('click', () => openComposer({ fileIds: [b.dataset.send] })));
  $$('[data-view]', view).forEach((b) => b.addEventListener('click', () => preview(get(b.dataset.view))));
  $$('[data-edit]', view).forEach((b) => b.addEventListener('click', () => edit(get(b.dataset.edit), view)));
  $$('[data-del]', view).forEach((b) => b.addEventListener('click', async () => {
    if (await confirmDialog('למחוק את הקובץ?', { okText: 'מחיקה', danger: true })) { await files.remove(b.dataset.del); toast('הקובץ נמחק'); render(view); }
  }));
}

function guessCat(name) {
  const n = name.toLowerCase();
  if (/מצגת|deck|presentation|\.pptx?$|\.key$/.test(n)) return 'מצגות';
  if (/תמצית|executive|summary|one.?pager/.test(n)) return 'תמצית מנהלים';
  if (/ברושור|brochure|flyer/.test(n)) return 'ברושורים';
  if (/דוח|report|research|סקירה/.test(n)) return 'דוחות ומחקרים';
  if (/טופס|הסכם|form|agreement|contract/.test(n)) return 'טפסים והסכמים';
  return 'אחר';
}

function preview(f) {
  const u = URL.createObjectURL(f.blob);
  const t = f.type || '';
  const body = t.startsWith('image/') ? `<img src="${u}" style="max-width:100%;border-radius:12px;display:block;margin:auto">`
    : t === 'application/pdf' ? `<iframe src="${u}" style="width:100%;height:70vh;border:0;border-radius:12px;background:#fff"></iframe>`
    : t.startsWith('video/') ? `<video src="${u}" controls style="width:100%;border-radius:12px"></video>`
    : `<div class="empty"><div class="big">${icon('file')}</div><h3>אין תצוגה מקדימה לסוג קובץ זה</h3><div>ניתן להוריד את הקובץ ולפתוח אותו במחשב</div></div>`;
  const { el } = openModal({
    title: esc(f.name), size: 'wide', body,
    foot: `<button class="btn" data-dl>${icon('download')}הורדה</button><button class="btn primary" data-send>${icon('send')}שליחה במייל</button>`,
    onClose: () => URL.revokeObjectURL(u),
  });
  $('[data-dl]', el).addEventListener('click', () => downloadBlob(f.blob, f.name));
  $('[data-send]', el).addEventListener('click', () => openComposer({ fileIds: [f.id] }));
}

function edit(f, view) {
  const { el, close } = openModal({
    title: 'עריכת קובץ', size: 'narrow',
    body: `<div class="grid" style="gap:14px">
      <div class="field"><label>שם</label><input class="input" id="eN" value="${esc(f.name)}"></div>
      <div class="field"><label>קטגוריה</label><select class="input" id="eC">${FILE_CATEGORIES.map((c) => `<option ${c === f.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>תיאור</label><textarea class="input" id="eD" rows="3">${esc(f.description || '')}</textarea></div></div>`,
    foot: `<button class="btn" data-close>ביטול</button><button class="btn primary" data-ok>שמירה</button>`,
  });
  $('[data-ok]', el).addEventListener('click', async () => {
    Object.assign(f, { name: $('#eN', el).value.trim() || f.name, category: $('#eC', el).value, description: $('#eD', el).value.trim() });
    await files.put(f);
    close();
    toast('נשמר');
    render(view);
  });
}
