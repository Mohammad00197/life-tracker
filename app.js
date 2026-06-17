(() => {
'use strict';

const HABIT_COLORS = ['#007AFF','#34C759','#FF3B30','#FF9500','#AF52DE','#FF2D55','#30B0C7','#FFCC00'];
const HABIT_EMOJIS = ['\u{1F9D8}','\u{1F4DA}','\u{1F4AA}','\u{1F4A7}','\u{1F634}','\u{1F3C3}','\u{1F3AF}','\u{270D}\u{FE0F}','\u{1F9E0}','\u{1F957}','\u{1F48A}','\u{1F3B8}','\u{1F6B6}','\u{1F9F9}','\u{1F4DD}','\u{1F605}'];
const DAY_SHORT = ['S','M','T','W','T','F','S'];

const PROFILES = {
  mohammad: { name: 'Mohammad', initial: 'M', gradient: 'linear-gradient(135deg,#007AFF,#5856D6)', color: '#007AFF' },
  karam:    { name: 'Karam',    initial: 'K', gradient: 'linear-gradient(135deg,#FF2D55,#FF9500)', color: '#FF2D55' }
};

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

function completedToday(h) { return (h.completions || []).includes(todayStr()); }

function periodCount(h) {
  if (h.period === 'daily') return completedToday(h) ? 1 : 0;
  const ws = weekStart();
  return (h.completions || []).filter(d => d >= ws).length;
}

function calcStreak(h) {
  let streak = 0;
  const d = new Date();
  const completions = h.completions || [];
  if (!completions.includes(todayStr())) d.setDate(d.getDate()-1);
  const set = new Set(completions);
  for (let i = 0; i < 365; i++) {
    if (set.has(dateToStr(d))) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

function bestStreak(h) {
  const completions = h.completions || [];
  if (!completions.length) return 0;
  const sorted = [...completions].sort();
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

function progress(h) { return Math.min(periodCount(h) / (h.target || 1), 1); }

function commitmentPct(habits) {
  if (!habits.length) return 0;
  const now = new Date();
  let possible = 0, done = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = dateToStr(d);
    habits.forEach(h => {
      if (ds < (h.createdAt || '2020-01-01')) return;
      if (h.period === 'daily') {
        possible++;
        if ((h.completions || []).includes(ds)) done++;
      }
    });
  }
  habits.forEach(h => {
    if (h.period === 'weekly') {
      const weeks = 4;
      possible += weeks * (h.target || 1);
      done += Math.min((h.completions || []).length, possible);
    }
  });
  return possible > 0 ? Math.round(done / possible * 100) : 0;
}

function totalCompletions(habits) {
  return habits.reduce((s, h) => s + ((h.completions || []).length), 0);
}

function bestStreakAcross(habits) {
  return habits.reduce((b, h) => Math.max(b, calcStreak(h)), 0);
}

function doneToday(habits) {
  return habits.filter(h => completedToday(h)).length;
}

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

// ---- State ----

let state = {
  me: localStorage.getItem('me') || null,
  activeTab: 'today',
  profiles: { mohammad: { habits: [] }, karam: { habits: [] } }
};

function myHabits() { return state.me ? (state.profiles[state.me]?.habits || []) : []; }
function otherKey() { return state.me === 'mohammad' ? 'karam' : 'mohammad'; }
function otherHabits() { return state.profiles[otherKey()]?.habits || []; }

// ---- Firebase ----

let db = null;
let syncReady = false;

function showSync(text, isErr) {
  const el = $('.sync-status') || (() => {
    const d = document.createElement('div');
    d.className = 'sync-status';
    document.body.appendChild(d);
    return d;
  })();
  el.textContent = text;
  el.classList.toggle('err', !!isErr);
  el.classList.add('show');
  clearTimeout(showSync._t);
  showSync._t = setTimeout(() => el.classList.remove('show'), 1500);
}

function initFirebase() {
  if (!window.FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) {
    showSync('No sync — set up Firebase', true);
    return false;
  }
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
    ['mohammad', 'karam'].forEach(name => {
      db.ref('profiles/' + name).on('value', snap => {
        const v = snap.val();
        try {
          state.profiles[name] = v ? (typeof v === 'string' ? JSON.parse(v) : v) : { habits: [] };
        } catch (e) {
          state.profiles[name] = { habits: [] };
        }
        if (!state.profiles[name].habits) state.profiles[name].habits = [];
        syncReady = true;
        if (state.me) render();
      }, err => {
        showSync('Sync error', true);
        console.error(err);
      });
    });
    return true;
  } catch (e) {
    console.error(e);
    showSync('Sync failed', true);
    return false;
  }
}

function saveMine() {
  if (!state.me) return;
  if (db) {
    db.ref('profiles/' + state.me).set(JSON.stringify(state.profiles[state.me]))
      .then(() => showSync('Synced'))
      .catch(() => showSync('Sync error', true));
  } else {
    // Fallback to localStorage if Firebase not configured
    localStorage.setItem('profile-' + state.me, JSON.stringify(state.profiles[state.me]));
  }
}

function loadLocalFallback() {
  ['mohammad', 'karam'].forEach(name => {
    try {
      const raw = localStorage.getItem('profile-' + name);
      if (raw) state.profiles[name] = JSON.parse(raw);
    } catch (e) {}
    if (!state.profiles[name].habits) state.profiles[name].habits = [];
  });
}

// ---- Navigation ----

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

function profileAvatarBtn() {
  const p = PROFILES[state.me];
  return `<button class="profile-avatar" data-action="switch-profile" style="background:${p.gradient}">${p.initial}</button>`;
}

// ---- Today ----

function renderToday() {
  const page = $('#page-today');
  const habits = myHabits();
  const t = todayStr();
  const done = doneToday(habits);
  const total = habits.length;
  const bestS = bestStreakAcross(habits);
  const p = PROFILES[state.me];

  let habitsBlock = '';
  if (total > 0) {
    habitsBlock = `<div class="card">
      <div class="card-header">
        <span class="card-title">Today's Habits</span>
        <span style="font-size:13px;color:var(--text-3);font-variant-numeric:tabular-nums">${done} of ${total}</span>
      </div>
      <div class="rings-row">${habits.map(h => {
        const pp = progress(h);
        return `<div class="ring-item" data-action="toggle-habit" data-id="${h.id}">
          <div class="ring-container">
            ${ringHtml(50, 4.5, pp, h.color)}
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
      <div class="header-row">
        <div>
          <div class="greeting">${getGreeting()}, ${p.name.split(' ')[0]}</div>
          <div class="greeting-date">${fmtDateLong(t)}</div>
        </div>
        ${profileAvatarBtn()}
      </div>
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
  const habits = myHabits();
  let list = '';
  if (habits.length) {
    list = `<div class="card" style="padding:2px 16px">${habits.map(h => {
      const done = completedToday(h);
      const pp = progress(h);
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
          <div class="habit-ring">${ringHtml(34, 3, pp, h.color)}</div>
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
        <div style="display:flex;gap:10px;align-items:center">
          <button class="header-action" data-action="add-habit">+</button>
          ${profileAvatarBtn()}
        </div>
      </div>
    </div>
    <div class="page-content">${list}</div>`;
}

// ---- Stats (Comparative) ----

function weekDataFor(habits) {
  const now = new Date();
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = dateToStr(d);
    const count = habits.filter(h => (h.completions || []).includes(ds)).length;
    data.push({ day: DAY_SHORT[d.getDay()], count, isToday: i === 0 });
  }
  return data;
}

function renderStats() {
  const page = $('#page-stats');
  const myH = myHabits();
  const otherH = otherHabits();
  const meProf = PROFILES[state.me];
  const otherProf = PROFILES[otherKey()];

  if (!myH.length && !otherH.length) {
    page.innerHTML = `<div class="page-header">
        <div class="header-row">
          <div class="page-title">Stats</div>
          ${profileAvatarBtn()}
        </div>
      </div>
      <div class="page-content">
        <div class="empty-state">
          <div class="empty-icon">\u{1F4CA}</div>
          <div class="empty-title">No data yet</div>
          <div class="empty-sub">Add habits to start the competition</div>
        </div>
      </div>`;
    return;
  }

  const myPct = commitmentPct(myH);
  const otherPct = commitmentPct(otherH);
  const myDone = doneToday(myH);
  const otherDone = doneToday(otherH);
  const myBest = bestStreakAcross(myH);
  const otherBest = bestStreakAcross(otherH);
  const myTotal = totalCompletions(myH);
  const otherTotal = totalCompletions(otherH);

  // Determine leader for crown
  const myScore = myPct + myDone * 5 + myBest * 3;
  const otherScore = otherPct + otherDone * 5 + otherBest * 3;
  const leader = myScore > otherScore ? state.me : (otherScore > myScore ? otherKey() : null);

  const myWeek = weekDataFor(myH);
  const otherWeek = weekDataFor(otherH);
  const maxBar = Math.max(1, ...myWeek.map(w => w.count), ...otherWeek.map(w => w.count));

  const dualWeekChart = `<div class="card">
    <div class="card-header"><span class="card-title">This Week</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div>
        <div style="font-size:12px;color:${meProf.color};font-weight:600;text-align:center;margin-bottom:6px">${meProf.name}</div>
        <div class="week-chart" style="height:90px">${myWeek.map(w => {
          const pct = (w.count / maxBar) * 100;
          return `<div class="week-bar">
            <span class="week-bar-count" style="font-size:10px">${w.count || ''}</span>
            <div class="week-bar-fill" style="height:${Math.max(pct, 4)}%;background:${w.count > 0 ? meProf.color : 'var(--fill-2)'}"></div>
            <span class="week-bar-label" style="font-size:10px">${w.day}</span>
          </div>`;
        }).join('')}</div>
      </div>
      <div>
        <div style="font-size:12px;color:${otherProf.color};font-weight:600;text-align:center;margin-bottom:6px">${otherProf.name}</div>
        <div class="week-chart" style="height:90px">${otherWeek.map(w => {
          const pct = (w.count / maxBar) * 100;
          return `<div class="week-bar">
            <span class="week-bar-count" style="font-size:10px">${w.count || ''}</span>
            <div class="week-bar-fill" style="height:${Math.max(pct, 4)}%;background:${w.count > 0 ? otherProf.color : 'var(--fill-2)'}"></div>
            <span class="week-bar-label" style="font-size:10px">${w.day}</span>
          </div>`;
        }).join('')}</div>
      </div>
    </div>
  </div>`;

  page.innerHTML = `<div class="page-header">
      <div class="header-row">
        <div class="page-title">Stats</div>
        ${profileAvatarBtn()}
      </div>
    </div>
    <div class="page-content">
      <div class="card">
        <div class="vs-header">
          <div class="vs-header-side">
            <div class="vs-header-avatar" style="background:${meProf.gradient}">${meProf.initial}</div>
            <div class="vs-header-name">${meProf.name}</div>
          </div>
          <div class="vs-divider">VS</div>
          <div class="vs-header-side">
            <div class="vs-header-avatar" style="background:${otherProf.gradient}">${otherProf.initial}</div>
            <div class="vs-header-name">${otherProf.name}</div>
          </div>
        </div>

        ${leader ? `<div class="winner-banner"><span class="crown">\u{1F451}</span> ${PROFILES[leader].name} leads</div>` : ''}

        <div class="vs-row">
          <div class="vs-side left">
            <div class="vs-value" style="color:${meProf.color}">${myPct}%</div>
          </div>
          <div class="vs-divider">30 day<br>commit</div>
          <div class="vs-side right">
            <div class="vs-value" style="color:${otherProf.color}">${otherPct}%</div>
          </div>
        </div>

        <div class="vs-row">
          <div class="vs-side left">
            <div class="vs-value" style="color:${meProf.color}">${myDone}/${myH.length || 0}</div>
          </div>
          <div class="vs-divider">today</div>
          <div class="vs-side right">
            <div class="vs-value" style="color:${otherProf.color}">${otherDone}/${otherH.length || 0}</div>
          </div>
        </div>

        <div class="vs-row">
          <div class="vs-side left">
            <div class="vs-value" style="color:var(--orange)">\u{1F525} ${myBest}</div>
          </div>
          <div class="vs-divider">best<br>streak</div>
          <div class="vs-side right">
            <div class="vs-value" style="color:var(--orange)">\u{1F525} ${otherBest}</div>
          </div>
        </div>

        <div class="vs-row">
          <div class="vs-side left">
            <div class="vs-value" style="color:${meProf.color}">${myTotal}</div>
          </div>
          <div class="vs-divider">total<br>checks</div>
          <div class="vs-side right">
            <div class="vs-value" style="color:${otherProf.color}">${otherTotal}</div>
          </div>
        </div>
      </div>

      ${dualWeekChart}

      ${myH.length > 0 ? `<div class="card" style="padding:2px 16px">
        <div class="card-header" style="padding-top:12px"><span class="card-title">My Habits</span></div>
        ${myH.map(h => {
          const str = calcStreak(h);
          const best = bestStreak(h);
          const total = (h.completions || []).length;
          let possible = 0, done = 0;
          if (h.period === 'daily') {
            const now = new Date();
            for (let i = 0; i < 30; i++) {
              const d = new Date(now); d.setDate(d.getDate() - i);
              const ds = dateToStr(d);
              if (ds < (h.createdAt || '2020-01-01')) continue;
              possible++;
              if ((h.completions || []).includes(ds)) done++;
            }
          } else {
            possible = 4 * (h.target || 1);
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
        }).join('')}
      </div>` : ''}
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
  const habits = myHabits();
  const h = editId ? habits.find(x => x.id === editId) : null;
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

  const habits = myHabits();
  if (editId) {
    const h = habits.find(x => x.id === editId);
    if (h) Object.assign(h, { name, emoji, color, period, target });
  } else {
    habits.push({ id: uid(), name, emoji, color, target, period, completions: [], createdAt: todayStr() });
  }
  state.profiles[state.me].habits = habits;
  saveMine();
  closeSheet();
  render();
}

function toggleHabit(id) {
  const habits = myHabits();
  const h = habits.find(x => x.id === id);
  if (!h) return;
  if (!h.completions) h.completions = [];
  const t = todayStr();
  const i = h.completions.indexOf(t);
  if (i >= 0) h.completions.splice(i, 1);
  else h.completions.push(t);
  state.profiles[state.me].habits = habits;
  saveMine();
  render();

  const btn = $(`.habit-check[data-id="${id}"]`);
  if (btn) { btn.classList.add('check-bounce'); setTimeout(() => btn.classList.remove('check-bounce'), 350); }
}

function deleteHabit(id) {
  state.profiles[state.me].habits = myHabits().filter(x => x.id !== id);
  saveMine();
  closeSheet();
  render();
}

// ---- Profile Switcher Sheet ----

function showProfileSwitch() {
  const meK = state.me;
  openSheet(`<div class="sheet-title">Switch Profile</div>
    <div class="picker-grid" style="margin-bottom:18px">
      ${Object.entries(PROFILES).map(([k, p]) => `
        <button class="picker-card" data-action="set-profile" data-profile="${k}" style="${k === meK ? 'outline:3px solid var(--blue)' : ''}">
          <div class="picker-avatar" style="background:${p.gradient}">${p.initial}</div>
          <div class="picker-name">${p.name}</div>
        </button>
      `).join('')}
    </div>`);
}

function setProfile(name) {
  state.me = name;
  localStorage.setItem('me', name);
  closeSheet();
  $('#profile-picker').style.display = 'none';
  $('#app').style.display = '';
  render();
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
    else if (a === 'switch-profile') showProfileSwitch();
    else if (a === 'set-profile') setProfile(el.dataset.profile);
    return;
  }

  const pickCard = e.target.closest('#profile-picker .picker-card');
  if (pickCard) { setProfile(pickCard.dataset.profile); return; }

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

// ---- Auth ----

const AUTH_HASH = '74603efd002ea40945e36f65cd5293699d589b5836fbb1115d62399b2a31c173';
const AUTH_KEY = 'life-tracker-auth';

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function unlockApp() {
  $('#auth-screen').classList.add('hidden');

  const ok = initFirebase();
  if (!ok) loadLocalFallback();

  if (!state.me) {
    $('#profile-picker').style.display = 'flex';
  } else {
    $('#app').style.display = '';
    render();
  }
}

async function tryAuth() {
  const pw = $('#auth-input')?.value || '';
  const hash = await sha256(pw);
  if (hash === AUTH_HASH) {
    localStorage.setItem(AUTH_KEY, 'ok');
    unlockApp();
  } else {
    $('#auth-error').textContent = 'Wrong password';
    $('#auth-input').classList.add('shake');
    setTimeout(() => $('#auth-input').classList.remove('shake'), 450);
    $('#auth-input').value = '';
  }
}

$('#auth-btn').addEventListener('click', tryAuth);
$('#auth-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryAuth(); });

// ---- Init ----

if (localStorage.getItem(AUTH_KEY) === 'ok') {
  unlockApp();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

})();
