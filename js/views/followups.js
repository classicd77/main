import { state, fullName, updateLead, addActivity, statusById } from '../store.js';
import { esc, icon, fmtMoneyShort, timeAgo, avatar, dueBadge, dayDiff, toISODate, toast, $$ } from '../util.js';
import { statusBadge, openComposer } from '../components.js';
import { isOpen } from '../metrics.js';

export function render(view) {
  const open = state.leads.filter((l) => !l.archived && isOpen(l));
  const groups = [
    { id: 'over', title: 'באיחור', ic: 'alert', items: open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) < 0) },
    { id: 'today', title: 'היום', ic: 'bell', items: open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) === 0) },
    { id: 'week', title: '7 הימים הקרובים', ic: 'calendar', items: open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) > 0 && dayDiff(l.nextFollowUp) <= 7) },
    { id: 'later', title: 'בהמשך', ic: 'clock', items: open.filter((l) => l.nextFollowUp && dayDiff(l.nextFollowUp) > 7) },
    { id: 'none', title: 'לידים פעילים ללא מעקב מתוזמן', ic: 'flag', items: open.filter((l) => !l.nextFollowUp) },
  ];
  groups.forEach((g) => g.items.sort((a, b) => (a.nextFollowUp || '').localeCompare(b.nextFollowUp || '') || (Number(b.amount) || 0) - (Number(a.amount) || 0)));
  const stale = open.filter((l) => (Date.now() - new Date(l.activities[0]?.at || l.updatedAt)) / 864e5 > 14).length;

  view.innerHTML = `
    <div class="page-head"><div><h1>מעקב ותזכורות</h1><div class="sub">${groups[0].items.length + groups[1].items.length} מעקבים דורשים טיפול היום · ${stale} לידים ללא פעילות מעל שבועיים</div></div></div>
    <div class="grid cols-4" style="margin-bottom:18px">
      ${groups.slice(0, 4).map((g) => `<div class="card kpi"><div class="label"><span class="k-ic">${icon(g.ic)}</span>${g.title}</div><div class="value num">${g.items.length}</div></div>`).join('')}
    </div>
    ${groups.map((g) => g.items.length ? `
      <div class="card" style="margin-bottom:18px">
        <div class="card-head"><h3>${icon(g.ic)} ${g.title}</h3><span class="badge">${g.items.length}</span></div>
        <div class="list">${g.items.map((l) => `
          <div class="list-item" data-lead="${l.id}" style="flex-wrap:wrap">
            ${avatar(l)}
            <div class="grow" style="min-width:180px"><div><b>${esc(fullName(l))}</b> <span class="small muted">· ${fmtMoneyShort(l.amount)}</span></div>
              <div class="small muted ellipsis">${l.activities[0] ? esc(l.activities[0].text) + ' · ' + timeAgo(l.activities[0].at) : ''}</div></div>
            ${statusBadge(l.status)}
            ${l.nextFollowUp ? dueBadge(l.nextFollowUp) : ''}
            <div class="row" data-stop>
              ${l.phone ? `<a class="icon-btn" href="tel:${esc(l.phone)}" title="חיוג">${icon('phone')}</a>` : ''}
              ${l.email ? `<button class="icon-btn" data-mail="${l.id}" title="מייל">${icon('mail')}</button>` : ''}
              <button class="btn sm" data-snooze="${l.id}" data-d="1" title="דחייה למחר">+1</button>
              <button class="btn sm" data-snooze="${l.id}" data-d="3">+3</button>
              <button class="btn sm" data-snooze="${l.id}" data-d="7">+7</button>
              ${l.nextFollowUp ? `<button class="btn sm primary" data-done="${l.id}">${icon('check')}בוצע</button>` : ''}
            </div>
          </div>`).join('')}</div>
      </div>` : '').join('')}
    ${open.length ? '' : `<div class="card"><div class="empty"><div class="big">${icon('check')}</div><h3>אין לידים פעילים למעקב</h3></div></div>`}`;

  const byId = (id) => state.leads.find((l) => l.id === id);
  $$('[data-lead]', view).forEach((el) => el.addEventListener('click', (e) => { if (!e.target.closest('[data-stop]')) location.hash = '#/lead/' + el.dataset.lead; }));
  $$('[data-mail]', view).forEach((b) => b.addEventListener('click', () => openComposer({ leads: [byId(b.dataset.mail)], templateId: 'tpl-followup' })));
  $$('[data-snooze]', view).forEach((b) => b.addEventListener('click', () => {
    const d = new Date(); d.setDate(d.getDate() + Number(b.dataset.d));
    updateLead(byId(b.dataset.snooze), { nextFollowUp: toISODate(d) });
    toast('המעקב נדחה');
  }));
  $$('[data-done]', view).forEach((b) => b.addEventListener('click', () => {
    const l = byId(b.dataset.done);
    addActivity(l, 'note', 'מעקב בוצע');
    const d = new Date(); d.setDate(d.getDate() + (state.settings.followUpDays || 3));
    updateLead(l, { nextFollowUp: toISODate(d) });
    toast(`בוצע · מעקב הבא נקבע בעוד ${state.settings.followUpDays || 3} ימים`);
  }));
}
