(() => {
'use strict';

const HABIT_COLORS = ['#007AFF','#34C759','#FF3B30','#FF9500','#AF52DE','#FF2D55','#30B0C7','#FFCC00'];
const HABIT_EMOJIS = ['\u{1F9D8}','\u{1F4DA}','\u{1F4AA}','\u{1F4A7}','\u{1F634}','\u{1F3C3}','\u{1F3AF}','\u{270D}\u{FE0F}','\u{1F9E0}','\u{1F957}','\u{1F48A}','\u{1F3B8}','\u{1F6B6}','\u{1F9F9}','\u{1F4DD}','\u{1F605}'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_SHORT = ['S','M','T','W','T','F','S'];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDateLong(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en', { weekday:'long', month:'long', day:'numeric' });
}

function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return dateToStr(d);
}

function completedToday(h) { return h.completions.includes(todayStr()); }

function periodCount(h) {
  if (h.period === 'daily') return completedToday(h) ? 1 : 0;
  const ws = weekStart();
  return h.completions.filter(d => d >= ws).length;
}

function calcStreak(h) {
  let streak = 0;
  const d = new Date();
  if (!h.completions.includes(todayStr())) d.setDate(d.getDate()-1);
  const set = new Set(h.completions);
  for (let i = 0; i < 365; i++) {
    if (set.has(dateToStr(d))) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

function bestStreak(h) {
  if (!h.completions.length) return 0;
  const sorted = [...h.completions].sort();
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i-1] + 'T12:00:00');
    const curr = new Date(sorted[i] + 'T12:00:00');
    const diff = (curr - prev) / 86400000;
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else if (diff > 1) cur = 1;
  }
  return best;
}

function progress(h) { return Math.min(periodCount(h) / h.target, 1); }

function ringHtml(size, sw, pct, color) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return `<svg class="progress-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle class="progress-ring-bg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${sw}"/>
    <circle class="progress-ring-fill" cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" style="--circ:${c.toFixed(2)}"/>
  </svg>`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// State
let state = { habits: [], activeTab: 'today' };

function save() { localStorage.setItem('life-tracker-data', JSON.stringify({ habits: state.habits })); }

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('life-tracker-data'));
    if (d) state.habits = d.habits || [];
  } catch(e) {}
}

// Navigation
function switchTab(tab) {
  state.activeTab = tab;
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + tab));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  render();
}

function render() {
  const fn = { today: renderToday, habits: renderHabits, stats: renderStats };
  fn[state.activeTab]();
}

// ---- Today ----

function renderToday() {
  const page = $('#page-today');
  const t = todayStr();
  const done = state.habits.filter(h => completedToday(h)).length;
  const total = state.habits.length;
  const totalStreaks = state.habits.reduce((s, h) => s + calcStreak(h), 0);
  const bestS = state.habits.reduce((b, h) => Math.max(b, calcStreak(h)), 0);

  let habitsBlock = '';
  if (total > 0) {
    habitsBlock = `<div class="card">
      <div class="card-header">
        <span class="card-title">Today's Habits</span>
        <span style="font-size:13px;color:var(--text-3);font-variant-numeric:tabular-nums">${done} of ${total}</span>
      </div>
      <div class="rings-row">${state.habits.map(h => {
        const p = progress(h);
        return `<div class="ring-item" data-action="toggle-habit" data-id="${h.id}">
          <div class="ring-container">
            ${ringHtml(50, 4.5, p, h.color)}
            <span class="ring-emoji">${h.emoji}</span>
          </div>
          <span class="ring-label">${h.name}</span>
        </div>`;
      }).join('')}</div>
    </div>`;
  } else {
    habitsBlock = `<div class="card" style="cursor:pointer" data-action="go-habits">
      <div class="empty-state" style="padding:16px 0">
        <div class="empty-icon">\u{2728}</div>
        <div class="empty-title">Start tracking habits</div>
        <div class="empty-sub">Tap to add your first habit</div>
      </div>
    </div>`;
  }

  page.innerHTML = `<div class="page-header">
      <div class="greeting">${getGreeting()}</div>
      <div class="greeting-date">${fmtDateLong(t)}</div>
    </div>
    <div class="page-content">
      ${habitsBlock}
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">${total > 0 ? Math.round(done / total * 100) : 0}%</div>
          <div class="stat-label">Done today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--orange)">${bestS > 0 ? '\u{1F525} ' + bestS : '—'}</div>
          <div class="stat-label">Best streak</div>
        </div>
      </div>
    </div>`;
}

// ---- Habits ----

function renderHabits() {
  const page = $('#page-habits');
  let list = '';
  if (state.habits.length) {
    list = `<div class="card" style="padding:2px 16px">${state.habits.map(h => {
      const done = completedToday(h);
      const p = progress(h);
      const cnt = periodCount(h);
      const str = calcStreak(h);
      return `<div class="habit-row">
        <div class="habit-tap" data-action="edit-habit" data-id="${h.id}">
          <span class="habit-emoji">${h.emoji}</span>
          <div class="habit-info">
            <div class="habit-name">${esc(h.name)}</div>
            <div class="habit-meta">
              <span>${cnt}/${h.target} ${h.period === 'daily' ? 'today' : 'this week'}</span>
              ${str > 0 ? `<span class="streak">\u{1F525} ${str}</span>` : ''}
            </div>
          </div>
          <div class="habit-ring">${ringHtml(34, 3, p, h.color)}</div>
        </div>
        <button class="habit-check ${done ? 'done' : ''}" data-action="toggle-habit" data-id="${h.id}" ${done ? `style="background:${h.color}"` : ''}>
          <svg viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6"/></svg>
        </button>
      </div>`;
    }).join('')}</div>`;
  } else {
    list = `<div class="empty-state">
      <div class="empty-icon">\u{1F3AF}</div>
      <div class="empty-title">No habits yet</div>
      <div class="empty-sub">Tap + to build your first habit</div>
    </div>`;
  }
  page.innerHTML = `<div class="page-header">
      <div class="header-row">
        <div class="page-title">Habits</div>
        <button class="header-action" data-action="add-habit">+</button>
      </div>
    </div>
    <div class="page-content">${list}</div>`;
}

// ---- Stats ----

function renderStats() {
  const page = $('#page-stats');
  const habits = state.habits;

  if (!habits.length) {
    page.innerHTML = `<div class="page-header"><div class="page-title">Stats</div></div>
      <div class="page-content">
        <div class="empty-state">
          <div class="empty-icon">\u{1F4CA}</div>
          <div class="empty-title">No data yet</div>
          <div class="empty-sub">Add habits to see your commitment stats</div>
        </div>
      </div>`;
    return;
  }

  // Overall completion rate (last 30 days)
  const now = new Date();
  let totalPossible = 0, totalDone = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = dateToStr(d);
    habits.forEach(h => {
      const created = h.createdAt || '2020-01-01';
      if (ds < created) return;
      if (h.period === 'daily') {
        totalPossible++;
        if (h.completions.includes(ds)) totalDone++;
      }
    });
  }
  // For weekly habits, approximate
  habits.forEach(h => {
    if (h.period === 'weekly') {
      const created = h.createdAt || '2020-01-01';
      const weeks = Math.min(4, Math.ceil((now - new Date(created + 'T12:00:00')) / 604800000));
      totalPossible += weeks * h.target;
      totalDone += h.completions.length;
    }
  });
  const overallPct = totalPossible > 0 ? Math.round(totalDone / totalPossible * 100) : 0;

  // Weekly chart — last 7 days
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = dateToStr(d);
    const dayDone = habits.filter(h => h.completions.includes(ds)).length;
    weekData.push({ day: DAY_SHORT[d.getDay()], count: dayDone, isToday: i === 0, date: ds });
  }
  const maxCount = Math.max(habits.length, 1);

  const weekHtml = weekData.map(w => {
    const pct = Math.max((w.count / maxCount) * 100, 5);
    const cls = w.isToday ? 'today' : (w.count > 0 ? 'active' : '');
    return `<div class="week-bar">
      <span class="week-bar-count">${w.count || ''}</span>
      <div class="week-bar-fill ${cls}" style="height:${pct}%"></div>
      <span class="week-bar-label">${w.day}</span>
    </div>`;
  }).join('');

  // Per-habit stats
  const habitStatsHtml = habits.map(h => {
    const str = calcStreak(h);
    const best = bestStreak(h);
    const total = h.completions.length;

    // Completion rate (last 30 days for daily, last 4 weeks for weekly)
    let possible = 0, done = 0;
    if (h.period === 'daily') {
      for (let i = 0; i < 30; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const ds = dateToStr(d);
        if (ds < (h.createdAt || '2020-01-01')) continue;
        possible++;
        if (h.completions.includes(ds)) done++;
      }
    } else {
      possible = 4 * h.target;
      done = Math.min(total, possible);
    }
    const pct = possible > 0 ? Math.round(done / possible * 100) : 0;

    return `<div class="habit-stat-row">
      <span class="habit-stat-emoji">${h.emoji}</span>
      <div class="habit-stat-info">
        <div class="habit-stat-name">${esc(h.name)}</div>
        <div class="habit-stat-detail">\u{1F525} ${str} current · ${best} best · ${total} total</div>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${pct}%;background:${h.color}"></div>
        </div>
      </div>
      <span class="habit-stat-pct" style="color:${h.color}">${pct}%</span>
    </div>`;
  }).join('');

  page.innerHTML = `<div class="page-header"><div class="page-title">Stats</div></div>
    <div class="page-content">
      <div class="big-stat">
        <div class="big-stat-value" style="color:var(--${overallPct >= 70 ? 'green' : overallPct >= 40 ? 'orange' : 'red'})">${overallPct}%</div>
        <div class="big-stat-label">Commitment · last 30 days</div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">This Week</span></div>
        <div class="week-chart">${weekHtml}</div>
      </div>

      <div class="card" style="padding:2px 16px">
        <div class="card-header" style="padding-top:12px"><span class="card-title">Per Habit</span></div>
        ${habitStatsHtml}
      </div>
    </div>`;
}

// ---- Modal ----

function openSheet(html) {
  const sheet = $('#modal-sheet');
  sheet.innerHTML = `<div class="sheet-handle"></div>${html}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $('#modal-overlay').classList.add('open');
      sheet.classList.add('open');
    });
  });
}

function closeSheet() {
  $('#modal-overlay').classList.remove('open');
  $('#modal-sheet').classList.remove('open');
}

// ---- Habit Modal ----

function showHabitModal(editId) {
  const h = editId ? state.habits.find(x => x.id === editId) : null;
  const selEmoji = h ? h.emoji : HABIT_EMOJIS[0];
  const selColor = h ? h.color : HABIT_COLORS[0];
  const selPeriod = h ? h.period : 'daily';

  openSheet(`<div class="sheet-title">${h ? 'Edit Habit' : 'New Habit'}</div>
    <div class="input-group">
      <label class="input-label">Icon</label>
      <div class="emoji-grid">${HABIT_EMOJIS.map(e =>
        `<button class="emoji-btn${e === selEmoji ? ' selected' : ''}" data-emoji="${e}">${e}</button>`
      ).join('')}</div>
    </div>
    <div class="input-group">
      <label class="input-label">Name</label>
      <input class="input" id="f-name" placeholder="e.g. Meditate" value="${h ? esc(h.name) : ''}" autocomplete="off">
    </div>
    <div class="input-group">
      <label class="input-label">Color</label>
      <div class="color-grid">${HABIT_COLORS.map(c =>
        `<div class="color-dot${c === selColor ? ' selected' : ''}" data-color="${c}" style="background:${c}"></div>`
      ).join('')}</div>
    </div>
    <div class="input-group">
      <label class="input-label">Frequency</label>
      <div class="segment-control" data-group="period">
        <button class="segment${selPeriod === 'daily' ? ' active' : ''}" data-val="daily">Daily</button>
        <button class="segment${selPeriod === 'weekly' ? ' active' : ''}" data-val="weekly">Weekly</button>
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Target per period</label>
      <input class="input" id="f-target" type="number" min="1" max="50" value="${h ? h.target : 1}" inputmode="numeric">
    </div>
    <button class="btn-primary" id="btn-save-habit" data-edit="${editId || ''}">
      ${h ? 'Save Changes' : 'Add Habit'}
    </button>
    ${h ? `<button class="delete-btn" data-action="delete-habit" data-id="${h.id}">Delete Habit</button>` : ''}`);

  setTimeout(() => { if (!h) $('#f-name')?.focus(); }, 500);
}

function saveHabit() {
  const name = $('#f-name')?.value.trim();
  if (!name) return;
  const emoji = $('.emoji-btn.selected')?.dataset.emoji || HABIT_EMOJIS[0];
  const color = $('.color-dot.selected')?.dataset.color || HABIT_COLORS[0];
  const period = $('[data-group="period"] .segment.active')?.dataset.val || 'daily';
  const target = Math.max(1, parseInt($('#f-target')?.value) || 1);
  const editId = $('#btn-save-habit')?.dataset.edit;

  if (editId) {
    const h = state.habits.find(x => x.id === editId);
    if (h) Object.assign(h, { name, emoji, color, period, target });
  } else {
    state.habits.push({ id: uid(), name, emoji, color, target, period, completions: [], createdAt: todayStr() });
  }
  save(); closeSheet(); render();
}

function toggleHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  const t = todayStr();
  const i = h.completions.indexOf(t);
  if (i >= 0) h.completions.splice(i, 1);
  else h.completions.push(t);
  save(); render();

  const btn = $(`.habit-check[data-id="${id}"]`);
  if (btn) { btn.classList.add('check-bounce'); setTimeout(() => btn.classList.remove('check-bounce'), 350); }
}

function deleteHabit(id) {
  state.habits = state.habits.filter(x => x.id !== id);
  save(); closeSheet(); render();
}

// ---- Events ----

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el) {
    const a = el.dataset.action;
    if (a === 'toggle-habit') toggleHabit(el.dataset.id);
    else if (a === 'add-habit') showHabitModal();
    else if (a === 'edit-habit') showHabitModal(el.dataset.id);
    else if (a === 'delete-habit') deleteHabit(el.dataset.id);
    else if (a === 'go-habits') switchTab('habits');
    return;
  }

  const tab = e.target.closest('.tab');
  if (tab) { switchTab(tab.dataset.tab); return; }

  if (e.target.id === 'modal-overlay') { closeSheet(); return; }

  const emoji = e.target.closest('.emoji-btn');
  if (emoji) { $$('.emoji-btn').forEach(b => b.classList.remove('selected')); emoji.classList.add('selected'); return; }

  const dot = e.target.closest('.color-dot');
  if (dot) { $$('.color-dot').forEach(b => b.classList.remove('selected')); dot.classList.add('selected'); return; }

  const seg = e.target.closest('.segment');
  if (seg) {
    seg.parentElement.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    return;
  }

  if (e.target.id === 'btn-save-habit') { saveHabit(); return; }
});

// ---- Init ----

load();
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

})();
