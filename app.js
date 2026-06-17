(() => {
'use strict';

const CATEGORIES = {
  expense: [
    { name: 'Food', emoji: '\u{1F354}' },
    { name: 'Coffee', emoji: '\u{2615}' },
    { name: 'Transport', emoji: '\u{1F697}' },
    { name: 'Shopping', emoji: '\u{1F6D2}' },
    { name: 'Housing', emoji: '\u{1F3E0}' },
    { name: 'Health', emoji: '\u{1F48A}' },
    { name: 'Fun', emoji: '\u{1F3AC}' },
    { name: 'Bills', emoji: '\u{1F4F1}' },
    { name: 'Education', emoji: '\u{1F4DA}' },
    { name: 'Other', emoji: '\u{1F4E6}' }
  ],
  income: [
    { name: 'Salary', emoji: '\u{1F4B0}' },
    { name: 'Freelance', emoji: '\u{1F4BB}' },
    { name: 'Investment', emoji: '\u{1F4C8}' },
    { name: 'Gift', emoji: '\u{1F381}' },
    { name: 'Other', emoji: '\u{1F4B5}' }
  ]
};

const HABIT_COLORS = ['#007AFF','#34C759','#FF3B30','#FF9500','#AF52DE','#FF2D55','#30B0C7','#FFCC00'];
const HABIT_EMOJIS = ['\u{1F9D8}','\u{1F4DA}','\u{1F4AA}','\u{1F4A7}','\u{1F634}','\u{1F3C3}','\u{1F3AF}','\u{270D}\u{FE0F}','\u{1F9E0}','\u{1F957}','\u{1F48A}','\u{1F3B8}','\u{1F6B6}','\u{1F9F9}','\u{1F4DD}','\u{1F605}'];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateFromStr(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDateLong(s) {
  return dateFromStr(s).toLocaleDateString('en', { weekday:'long', month:'long', day:'numeric' });
}

function fmtDateShort(s) {
  const t = todayStr();
  if (s === t) return 'Today';
  const y = new Date(); y.setDate(y.getDate()-1);
  const ys = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
  if (s === ys) return 'Yesterday';
  return dateFromStr(s).toLocaleDateString('en', { month:'short', day:'numeric' });
}

function fmtMoney(n) {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '−' : '') + '$' + abs;
}

function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (set.has(s)) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
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

// State
let state = { habits: [], transactions: [], activeTab: 'today' };

function save() { localStorage.setItem('life-tracker-data', JSON.stringify({ habits: state.habits, transactions: state.transactions })); }

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('life-tracker-data'));
    if (d) { state.habits = d.habits || []; state.transactions = d.transactions || []; }
  } catch(e) {}
}

// Navigation
function switchTab(tab) {
  state.activeTab = tab;
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + tab));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  render();
}

// Render dispatcher
function render() {
  const fn = { today: renderToday, habits: renderHabits, money: renderMoney };
  fn[state.activeTab]();
}

function renderToday() {
  const page = $('#page-today');
  const t = todayStr();
  const done = state.habits.filter(h => completedToday(h)).length;
  const total = state.habits.length;
  const spent = state.transactions.filter(x => x.date === t && x.type === 'expense').reduce((s,x) => s + x.amount, 0);
  const bal = state.transactions.reduce((s,x) => s + (x.type === 'income' ? x.amount : -x.amount), 0);
  const now = new Date();
  const ms = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const mtx = state.transactions.filter(x => x.date >= ms);
  const mInc = mtx.filter(x => x.type === 'income').reduce((s,x) => s + x.amount, 0);
  const mExp = mtx.filter(x => x.type === 'expense').reduce((s,x) => s + x.amount, 0);

  let habitsBlock = '';
  if (total > 0) {
    habitsBlock = `<div class="card">
      <div class="card-header">
        <span class="card-title">Habits</span>
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
        <div class="empty-icon">✨</div>
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
          <div class="stat-value">${fmtMoney(spent)}</div>
          <div class="stat-label">Spent today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:${bal >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoney(bal)}</div>
          <div class="stat-label">Balance</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">This Month</span></div>
        <div class="month-row">
          <div class="month-item">
            <div class="month-value" style="color:var(--green)">+${fmtMoney(mInc)}</div>
            <div class="month-label">Income</div>
          </div>
          <div class="month-item">
            <div class="month-value" style="color:var(--red)">−${fmtMoney(mExp)}</div>
            <div class="month-label">Expenses</div>
          </div>
          <div class="month-item">
            <div class="month-value" style="color:${mInc - mExp >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoney(mInc - mExp)}</div>
            <div class="month-label">Saved</div>
          </div>
        </div>
      </div>
    </div>`;
}

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

function renderMoney() {
  const page = $('#page-money');
  const bal = state.transactions.reduce((s,x) => s + (x.type === 'income' ? x.amount : -x.amount), 0);
  const now = new Date();
  const ms = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const mtx = state.transactions.filter(x => x.date >= ms);
  const mInc = mtx.filter(x => x.type === 'income').reduce((s,x) => s + x.amount, 0);
  const mExp = mtx.filter(x => x.type === 'expense').reduce((s,x) => s + x.amount, 0);

  const sorted = [...state.transactions].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const groups = {};
  sorted.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });

  let txHtml = '';
  if (sorted.length) {
    txHtml = Object.entries(groups).map(([date, txs]) =>
      `<div class="date-group-label">${fmtDateShort(date)}</div>` +
      txs.map(t => `<div class="tx-row" data-action="view-tx" data-id="${t.id}">
        <div class="tx-icon">${t.emoji}</div>
        <div class="tx-info">
          <div class="tx-category">${esc(t.category)}</div>
          ${t.note ? `<div class="tx-note">${esc(t.note)}</div>` : ''}
        </div>
        <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '−'}${fmtMoney(t.amount)}</div>
      </div>`).join('')
    ).join('');
  } else {
    txHtml = `<div class="empty-state" style="padding:28px 0">
      <div class="empty-icon">\u{1F4B8}</div>
      <div class="empty-title">No transactions yet</div>
      <div class="empty-sub">Tap + to log your first one</div>
    </div>`;
  }

  page.innerHTML = `<div class="page-header">
      <div class="header-row">
        <div class="page-title">Money</div>
        <button class="header-action" data-action="add-tx">+</button>
      </div>
    </div>
    <div class="page-content">
      <div class="balance-section">
        <div class="balance-label">Balance</div>
        <div class="balance-value" style="color:${bal >= 0 ? 'var(--text-1)' : 'var(--red)'}">${fmtMoney(bal)}</div>
      </div>
      <div class="summary-pills">
        <span class="pill" style="color:var(--green)">+${fmtMoney(mInc)}</span>
        <span class="pill" style="color:var(--red)">−${fmtMoney(mExp)}</span>
      </div>
      <div class="card" style="padding:0 16px">${txHtml}</div>
    </div>
    <button class="fab" data-action="add-tx">+</button>`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Modal
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

// Habit modal
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

// Transaction modal
function showTxModal() {
  const type = 'expense';
  openSheet(`<div class="sheet-title">New Transaction</div>
    <div class="segment-control" data-group="txtype">
      <button class="segment active" data-val="expense">Expense</button>
      <button class="segment" data-val="income">Income</button>
    </div>
    <div class="input-group">
      <label class="input-label">Amount</label>
      <input class="input" id="f-amount" type="number" step="0.01" min="0" placeholder="0.00" inputmode="decimal">
    </div>
    <div class="input-group">
      <label class="input-label">Category</label>
      <div class="category-grid" id="cat-grid">${catGridHtml(type)}</div>
    </div>
    <div class="input-group">
      <label class="input-label">Note</label>
      <input class="input" id="f-note" placeholder="Optional" autocomplete="off">
    </div>
    <div class="input-group">
      <label class="input-label">Date</label>
      <input class="input" id="f-date" type="date" value="${todayStr()}">
    </div>
    <button class="btn-primary" id="btn-save-tx">Add Transaction</button>`);

  setTimeout(() => $('#f-amount')?.focus(), 500);
}

function catGridHtml(type) {
  return CATEGORIES[type].map((c, i) =>
    `<button class="category-btn${i === 0 ? ' selected' : ''}" data-cat="${c.name}" data-emoji="${c.emoji}">
      <span class="cat-emoji">${c.emoji}</span><span>${c.name}</span>
    </button>`
  ).join('');
}

function saveTx() {
  const amount = parseFloat($('#f-amount')?.value);
  if (!amount || amount <= 0) return;
  const type = $('[data-group="txtype"] .segment.active')?.dataset.val || 'expense';
  const catBtn = $('.category-btn.selected');
  state.transactions.push({
    id: uid(),
    type,
    amount,
    category: catBtn?.dataset.cat || 'Other',
    emoji: catBtn?.dataset.emoji || '\u{1F4E6}',
    note: $('#f-note')?.value.trim() || '',
    date: $('#f-date')?.value || todayStr()
  });
  save(); closeSheet(); render();
}

function viewTx(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  openSheet(`<div class="sheet-title">Transaction</div>
    <div style="text-align:center;padding:12px 0 8px">
      <div style="font-size:40px;margin-bottom:6px">${t.emoji}</div>
      <div style="font-size:24px;font-weight:600;font-variant-numeric:tabular-nums">${t.type === 'income' ? '+' : '−'}${fmtMoney(t.amount)}</div>
      <div style="font-size:15px;color:var(--text-3);margin-top:5px">${esc(t.category)}${t.note ? ' · ' + esc(t.note) : ''}</div>
      <div style="font-size:13px;color:var(--text-3);margin-top:3px">${fmtDateLong(t.date)}</div>
    </div>
    <button class="delete-btn" data-action="delete-tx" data-id="${t.id}">Delete Transaction</button>`);
}

function deleteTx(id) {
  state.transactions = state.transactions.filter(x => x.id !== id);
  save(); closeSheet(); render();
}

// Event delegation
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el) {
    const a = el.dataset.action;
    if (a === 'toggle-habit') toggleHabit(el.dataset.id);
    else if (a === 'add-habit') showHabitModal();
    else if (a === 'edit-habit') showHabitModal(el.dataset.id);
    else if (a === 'delete-habit') deleteHabit(el.dataset.id);
    else if (a === 'add-tx') showTxModal();
    else if (a === 'view-tx') viewTx(el.dataset.id);
    else if (a === 'delete-tx') deleteTx(el.dataset.id);
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
    const ctrl = seg.parentElement;
    ctrl.querySelectorAll('.segment').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    if (ctrl.dataset.group === 'txtype') {
      const grid = $('#cat-grid');
      if (grid) grid.innerHTML = catGridHtml(seg.dataset.val);
    }
    return;
  }

  const cat = e.target.closest('.category-btn');
  if (cat) { $$('.category-btn').forEach(b => b.classList.remove('selected')); cat.classList.add('selected'); return; }

  if (e.target.id === 'btn-save-habit') { saveHabit(); return; }
  if (e.target.id === 'btn-save-tx') { saveTx(); return; }
});

// ---- PIN Lock ----

const LOCK_KEY = 'life-tracker-pin';
let pinBuffer = '';
let pinMode = 'unlock'; // 'setup', 'confirm', 'unlock'
let pinSetup = '';

function hashPin(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = ((h << 5) - h + pin.charCodeAt(i)) | 0; }
  return h.toString(36);
}

function initLock() {
  const stored = localStorage.getItem(LOCK_KEY);
  if (!stored) {
    pinMode = 'setup';
    $('#lock-title').textContent = 'Set a Passcode';
  } else {
    pinMode = 'unlock';
    $('#lock-title').textContent = 'Enter Passcode';
  }
  pinBuffer = '';
  updateDots();
}

function updateDots() {
  const dots = $$('#pin-dots span');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length));
}

function pinInput(n) {
  if (n === 'del') {
    pinBuffer = pinBuffer.slice(0, -1);
    updateDots();
    return;
  }
  if (n === '' || pinBuffer.length >= 4) return;
  pinBuffer += n;
  updateDots();
  if (pinBuffer.length < 4) return;

  setTimeout(() => {
    if (pinMode === 'setup') {
      pinSetup = pinBuffer;
      pinMode = 'confirm';
      $('#lock-title').textContent = 'Confirm Passcode';
      pinBuffer = '';
      updateDots();
    } else if (pinMode === 'confirm') {
      if (pinBuffer === pinSetup) {
        localStorage.setItem(LOCK_KEY, hashPin(pinBuffer));
        unlock();
      } else {
        $('#pin-error').textContent = 'Passcodes didn’t match';
        $('#pin-dots').classList.add('shake');
        setTimeout(() => $('#pin-dots').classList.remove('shake'), 450);
        pinMode = 'setup';
        $('#lock-title').textContent = 'Set a Passcode';
        pinBuffer = '';
        pinSetup = '';
        updateDots();
      }
    } else {
      const stored = localStorage.getItem(LOCK_KEY);
      if (hashPin(pinBuffer) === stored) {
        unlock();
      } else {
        $('#pin-error').textContent = 'Wrong passcode';
        $('#pin-dots').classList.add('shake');
        setTimeout(() => $('#pin-dots').classList.remove('shake'), 450);
        pinBuffer = '';
        updateDots();
      }
    }
  }, 120);
}

function unlock() {
  $('#lock-screen').classList.add('hidden');
  $('#app').style.display = '';
  load();
  render();
}

$('#pin-pad').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const n = btn.dataset.n;
  if (n !== undefined) pinInput(n);
});

// Init
initLock();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

})();
