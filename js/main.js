// ═══════════════════════════════════════════════
//  WordForge — UI Orchestrator (main.js)
//  Wires game engine, renderer, and all DOM elements
// ═══════════════════════════════════════════════

'use strict';

// ── State ──
const UIState = {
  gameActive: false,
  mode: 'daily',
  practice: false,
  darkMode: false,
  colorblind: false,
};

// ── Persistent stats via localStorage ──
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem('wf_stats') || '{}');
  } catch { return {}; }
}
function saveStats(s) {
  try { localStorage.setItem('wf_stats', JSON.stringify(s)); } catch {}
}
function getStats() {
  return Object.assign({
    played: 0, streak: 0, bestScore: 0,
    totalCompletion: 0, grades: [], lastPlayedDate: null,
  }, loadStats());
}
function updateStats(result, date) {
  const s = getStats();
  const today = date;
  if (s.lastPlayedDate !== today) {
    s.played++;
    const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10);
    s.streak = s.lastPlayedDate === yesterday ? s.streak + 1 : 1;
    s.lastPlayedDate = today;
  }
  if (result.score > s.bestScore) s.bestScore = result.score;
  s.totalCompletion = Math.round(((s.totalCompletion * (s.played - 1)) + result.pct) / s.played);
  s.grades = [result.grade, ...(s.grades || [])].slice(0, 14);
  saveStats(s);
  return s;
}

// ── Sound: short tones made in the browser, no sound files ──
const Sound = {
  ctx: null,
  muted: (() => { try { return localStorage.getItem('wf_mute') === '1'; } catch { return false; } })(),
  tone(freq, dur, type = 'sine', when = 0, vol = 0.08) {
    if (this.muted) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch {}
  },
  find()   { this.tone(660, 0.09); this.tone(880, 0.12, 'sine', 0.07); },
  target() { this.tone(523, 0.1); this.tone(659, 0.1, 'sine', 0.07); this.tone(784, 0.16, 'sine', 0.14); },
  miss()   { this.tone(150, 0.16, 'square', 0, 0.04); },
  repeat() { this.tone(440, 0.08, 'triangle'); },
  tick()   { this.tone(1000, 0.03, 'square', 0, 0.03); },
  end()    { this.tone(523, 0.2); this.tone(392, 0.3, 'sine', 0.15); },
  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('wf_mute', this.muted ? '1' : '0'); } catch {}
    $('btn-sound').textContent = this.muted ? '🔇' : '🔊';
    $('btn-sound').setAttribute('aria-label', this.muted ? 'Sound off' : 'Sound on');
    showToast(this.muted ? 'Sound off' : 'Sound on', 'info');
  },
};

// ── Modes: the daily board, numbered endless boards, and live rounds on a shared clock ──
// Each mode draws seeds from its own range, so an endless or live board never repeats a daily one.
const ENDLESS_BASE = 100000000;   // endless #N   -> seed 100,000,000 + N
const LIVE_BASE = 3000000000;     // live round R -> seed 3,000,000,000 + R
const LIVE_ROUND_MS = 120000;     // a new live board every 2 minutes:
const LIVE_PLAY_MS = 90000;       // 90 seconds to play, 30 for results
let clockOffset = 0;              // the site's clock minus this device's clock
let liveWait = null, liveTick = null;
const nowSynced = () => Date.now() + clockOffset;

// Everyone in a live round has to agree on the time, so I take it from the site, not the device
function syncClock() {
  fetch(location.href, { method: 'HEAD', cache: 'no-store' })
    .then(r => { const t = Date.parse(r.headers.get('Date')); if (!isNaN(t)) clockOffset = t - Date.now(); })
    .catch(() => {});
}
function nextEndless() {
  // A shared link (#endless-123) opens that puzzle once
  const fromLink = /^#endless-(\d{1,6})$/.exec(location.hash);
  if (fromLink && +fromLink[1] >= 1) {
    history.replaceState(null, '', location.pathname);
    return +fromLink[1];
  }
  let n = 0;
  try { n = parseInt(localStorage.getItem('wf_endless') || '0', 10); } catch {}
  return n >= 1 && n <= 999999 ? n : 1 + Math.floor(Math.random() * 999999);
}
function stopLiveTimers() {
  clearTimeout(liveWait);
  clearInterval(liveTick);
}
// Join the live round if there's time left in it; otherwise wait for the next board
function playLive() {
  stopLiveTimers();
  const now = nowSynced();
  const round = Math.floor(now / LIVE_ROUND_MS);
  const left = round * LIVE_ROUND_MS + LIVE_PLAY_MS - now;
  if (left >= 10000) {
    startGame('live', { round, duration: Math.floor(left / 1000) });
    return;
  }
  const startAt = (round + 1) * LIVE_ROUND_MS;
  hideStartScreen();
  UIState.mode = 'live';
  game.phase = 'idle';
  renderer.grid = [];
  $('target-slots').innerHTML = '';
  clearWordList();
  const show = () => {
    const s = Math.max(0, Math.ceil((startAt - nowSynced()) / 1000));
    $('current-word-text').textContent = `NEXT LIVE BOARD IN ${s}s`;
    $('cw-hint').textContent = 'EVERYONE GETS THE SAME ONE';
  };
  show();
  liveTick = setInterval(show, 500);
  liveWait = setTimeout(playLive, startAt - now + 50);
}

// ── One scored round a day; replays of the same board are practice ──
// The key is the board's own date (UTC), so one board never counts twice.
function boardDate() {
  const s = String(WordForgePuzzle.getDailySeed());
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function loadDay() {
  try { return JSON.parse(localStorage.getItem('wf_day') || 'null'); } catch { return null; }
}
function saveDay(d) {
  try { localStorage.setItem('wf_day', JSON.stringify(d)); } catch {}
}
function scoredToday() {
  const d = loadDay();
  return d && d.date === boardDate() ? d : null;
}
function untilNextBoard() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(0, Math.ceil((next - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function renderStartScreen() {
  const d = scoredToday();
  $('ss-today').textContent = d ? `TODAY: ${d.grade} · ${d.score.toLocaleString()} · NEXT BOARD IN ${untilNextBoard()}` : '';
  $('btn-start').textContent = d ? "▶ PRACTICE TODAY'S BOARD" : "▶ PLAY TODAY'S PUZZLE";
}

// ── Achievement definitions ──
const ACHIEVEMENTS = [
  { id: 'first_word',   emoji: '⚡', label: 'First Word',    check: r => r.found >= 1 },
  { id: 'five_words',   emoji: '🔥', label: '5 Words',       check: r => r.found >= 5 },
  { id: 'rare_word',    emoji: '💎', label: 'Long-Word Bonus', check: r => r.wordsFound.some(w => w.word.length >= 5) },
  { id: 'speedster',    emoji: '⚡', label: 'Speed Demon',    check: r => r.timeLeft >= 30 },
  { id: 'scholar',      emoji: '📚', label: 'Scholar',        check: r => r.pct >= 75 },
  { id: 'chrome_master',emoji: '🏆', label: 'Chrome Master',  check: r => r.pct >= 100 && r.timeLeft >= 15 },
  { id: 'long_word',    emoji: '🔭', label: '7+ Letter Word', check: r => r.wordsFound.some(w => w.word.length >= 7) },
  { id: 'daily_player', emoji: '📅', label: 'Daily Player',   check: (r, s) => s.streak >= 3 },
];

function loadUnlocked() {
  try { return new Set(JSON.parse(localStorage.getItem('wf_ach') || '[]')); } catch { return new Set(); }
}
function saveUnlocked(set) {
  try { localStorage.setItem('wf_ach', JSON.stringify([...set])); } catch {}
}

// ── DOM refs ──
const $  = id => document.getElementById(id);
const startScreen  = $('start-screen');
const resultModal  = $('result-modal');
const lbModal      = $('lb-modal');
const statsModal   = $('stats-modal');
const helpModal    = $('help-modal');

// ── Renderer & Game ──
let renderer, game;

function initRenderer() {
  const gridCanvas    = $('grid-canvas');
  const overlayCanvas = $('overlay-canvas');
  const wrap          = $('grid-wrap');

  renderer = new WordForgeRenderer(gridCanvas, overlayCanvas);

  // Layout on size
  const relayout = () => {
    const size = Math.min(wrap.clientWidth, wrap.clientHeight, 440);
    renderer.layout(size, size);
  };
  relayout();
  window.addEventListener('resize', relayout);

  renderer.startLoop();
}

function initGame() {
  game = new WordForgeGame(renderer);

  game.onWordFound = (word, pts, rarity) => {
    const target = game.isTarget(word);
    if (target) Sound.target(); else Sound.find();
    showToast(`✓ ${word.toUpperCase()} +${pts}${target ? ' · TARGET' : ''}`, 'success');
    if (target) fillSlot(word);
    else addWordToList(word, pts, rarity);
    updateProgress();
    if (UIState.mode === 'daily' && !UIState.practice) checkAchievements(null, null, word, pts, rarity);
    animateScore(pts);
  };

  game.onWordInvalid = (word, reason) => {
    if (reason === 'Already found') Sound.repeat(); else Sound.miss();
    showToast(reason, 'error');
    $('current-word-bar').classList.add('shake');
    setTimeout(() => $('current-word-bar').classList.remove('shake'), 400);
  };

  game.onGameEnd = (result) => {
    Sound.end();
    showResultModal(result);
  };

  game.onTimerTick = (t) => {
    if (t > 0 && t <= 10) Sound.tick();
    updateTimer(t);
  };

  game.onScoreUpdate = (score) => {
    $('score-val').textContent = score.toLocaleString();
  };

  game.onCurrentWordChange = (word) => {
    updateCurrentWord(word);
  };
}

// ── Starfield ──
function initStarfield() {
  const canvas = $('starfield');
  const ctx = canvas.getContext('2d');
  const stars = [];
  const STAR_COUNT = 120;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      speed: 0.00002 + Math.random() * 0.00008,
      alpha: 0.2 + Math.random() * 0.6,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 2,
    });
  }

  let lastT = 0;
  function frame(t) {
    const dt = t - lastT; lastT = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width, H = canvas.height;

    for (const s of stars) {
      s.x += s.speed * dt * 0.02;
      if (s.x > 1) s.x = 0;
      const twinkle = 0.6 + 0.4 * Math.sin(t * 0.001 * s.twinkleSpeed + s.twinklePhase);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,220,255,${s.alpha * twinkle})`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ── Timer UI ──
const TIMER_CIRCUMFERENCE = 207.3;
function updateTimer(t) {
  const ring = $('timer-ring');
  const num  = $('timer-num');
  const frac = t / GAME_DURATION;
  ring.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - frac);

  if (t <= 10) {
    ring.style.stroke = 'var(--timer-danger)';
    num.style.color = 'var(--pink)';
    if (t <= 5) num.classList.add('shake');
  } else if (t <= 20) {
    ring.style.stroke = 'var(--timer-warn)';
    num.style.color = 'var(--gold)';
  } else {
    ring.style.stroke = 'var(--timer-ok)';
    num.style.color = '';
  }

  num.textContent = t;
}

// ── Word list ──
function addWordToList(word, pts, rarity) {
  const list  = $('word-list');
  const empty = $('word-list-empty');
  empty.style.display = 'none';

  const item = document.createElement('div');
  item.className = 'word-found-item';
  item.setAttribute('role', 'listitem');
  item.innerHTML = `
    <span class="wfi-word bonus">${word.toUpperCase()}</span>
    <span class="wfi-pts">+${pts}</span>
  `;
  list.prepend(item);
}

// ── Target slots: blank boxes by length, filled as targets are found ──
function buildTargetSlots(puzzle) {
  const wrap = $('target-slots');
  wrap.innerHTML = '';
  const lengths = [...new Set(puzzle.targetWords.map(t => t.word.length))].sort((a, b) => a - b);
  for (const len of lengths) {
    const row = document.createElement('div');
    row.className = 'slot-row';
    row.innerHTML = `<span class="slot-len">${len}</span>`;
    for (const t of puzzle.targetWords.filter(t => t.word.length === len)) {
      const slot = document.createElement('span');
      slot.className = 'slot';
      slot.dataset.len = len;
      slot.textContent = '▢'.repeat(len);
      slot.setAttribute('aria-label', `${len}-letter target, not found yet`);
      row.appendChild(slot);
    }
    wrap.appendChild(row);
  }
}

function fillSlot(word, cls = 'found') {
  const slot = $('target-slots').querySelector(`.slot[data-len="${word.length}"]:not(.found):not(.missed)`);
  if (!slot) return;
  slot.className = `slot ${cls}`;
  slot.textContent = word.toUpperCase();
  slot.setAttribute('aria-label', `${word}, ${cls === 'found' ? 'found' : 'missed'}`);
}

function clearWordList() {
  $('word-list').innerHTML = '';
  $('word-list-empty').style.display = '';
}

// ── Progress bar ──
function updateProgress() {
  if (!game || !game.puzzle) return;
  const found = game.puzzle.targetWords.filter(tw => game.wordsFound.has(tw.word)).length;
  const total = game.puzzle.targetWords.length;
  const pct   = (found / total) * 100;
  $('progress-bar').style.width = pct + '%';
  $('found-count').textContent = found;
}

// ── Score animation ──
function animateScore(pts) {
  const el = $('score-val');
  el.style.transform = 'scale(1.3)';
  el.style.color = 'var(--cyan)';
  el.style.textShadow = '0 0 20px var(--cyan-glow)';
  setTimeout(() => {
    el.style.transform = '';
    el.style.color = '';
    el.style.textShadow = '';
    el.style.transition = 'all 0.3s ease';
  }, 300);
}

// ── Current word ──
function updateCurrentWord(word) {
  const bar = $('current-word-bar');
  const txt = $('current-word-text');
  const hint = $('cw-hint');

  if (!word) {
    txt.textContent = '';
    txt.className = 'cw-text';
    bar.classList.remove('has-word');
    hint.textContent = 'DRAG OR TYPE';
    return;
  }

  txt.textContent = word;
  bar.classList.add('has-word');
  hint.textContent = `${word.length} LETTERS — ENTER TO SUBMIT`;

  // Check validity for color feedback
  if (word.length >= 3 && WordForgePuzzle.TRIE.isWord(word.toLowerCase())) {
    txt.className = 'cw-text valid';
  } else {
    txt.className = 'cw-text';
  }
}

// ── Achievements ──
function buildAchievementGrid() {
  const grid = $('ach-grid');
  const unlocked = loadUnlocked();
  grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const el = document.createElement('div');
    el.className = 'ach-badge' + (unlocked.has(a.id) ? ' unlocked' : '');
    el.textContent = a.emoji;
    el.title = a.label + (unlocked.has(a.id) ? ' ✓' : ' (locked)');
    el.setAttribute('aria-label', a.label + (unlocked.has(a.id) ? ' - Unlocked' : ' - Locked'));
    grid.appendChild(el);
  }
}

function checkAchievements(result, stats, singleWord, pts, rarity) {
  const unlocked = loadUnlocked();
  const newlyUnlocked = [];

  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;

    let earned = false;
    if (result) {
      earned = a.check(result, stats);
    } else if (singleWord) {
      // Check word-level achievements
      if (a.id === 'first_word') earned = true;
      if (a.id === 'rare_word' && singleWord.length >= 5) earned = true;
      if (a.id === 'long_word' && singleWord.length >= 7) earned = true;
    }

    if (earned) {
      unlocked.add(a.id);
      newlyUnlocked.push(a);
    }
  }

  if (newlyUnlocked.length) {
    saveUnlocked(unlocked);
    buildAchievementGrid();
    for (const a of newlyUnlocked) {
      setTimeout(() => showToast(`🏅 Unlocked: ${a.label}!`, 'info'), 600);
    }
  }
}

// ── Toast ──
let toastTimer;
function showToast(msg, type = 'info') {
  const t = $('toast');
  clearTimeout(toastTimer);
  t.textContent = msg;
  t.className = `show ${type}`;
  toastTimer = setTimeout(() => t.className = '', 2200);
}

// ── Modal helpers ──
function openModal(el) {
  el.classList.add('open');
  const close = el.querySelector('.modal-close');
  if (close) close.focus();
}
function closeModal(el) {
  el.classList.remove('open');
}
function bindClose(backdropId, closeBtnId) {
  const backdrop = $(backdropId);
  const closeBtn = $(closeBtnId);
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal(backdrop));
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(backdrop); });
  backdrop.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(backdrop); });
}

// ── Result modal ──
function showResultModal(result) {
  // Found and total targets per word length, for the share text
  const rows = [...new Set(game.puzzle.targetWords.map(t => t.word.length))].sort((a, b) => a - b)
    .map(len => {
      const of = game.puzzle.targetWords.filter(t => t.word.length === len);
      return [len, of.filter(t => game.wordsFound.has(t.word)).length, of.length];
    });
  // Only the day's first finished daily round counts; practice, endless and live keep nothing
  if (UIState.mode === 'daily' && !UIState.practice) {
    const date = boardDate();
    const stats = updateStats(result, date);
    checkAchievements(result, stats, null, null, null);
    saveDay({ date, score: result.score, grade: result.grade, rows });
    submitScore(result);
  }
  UIState.last = { grade: result.grade, score: result.score, rows };
  $('result-title').textContent = UIState.mode === 'endless' ? `ENDLESS #${UIState.endless}`
    : UIState.mode === 'live' ? 'LIVE ROUND OVER'
    : UIState.practice ? 'PRACTICE ROUND · NOT SCORED' : 'ROUND COMPLETE';
  $('btn-retry').textContent = UIState.mode === 'endless' ? 'NEXT PUZZLE' : 'PRACTICE';
  if (UIState.mode === 'live') {
    // Count down to the next live board and move straight into it
    const startAt = (UIState.liveRound + 1) * LIVE_ROUND_MS;
    const tick = () => {
      const s = Math.max(0, Math.ceil((startAt - nowSynced()) / 1000));
      $('btn-retry').textContent = `NEXT BOARD IN ${s}s`;
    };
    tick();
    liveTick = setInterval(tick, 500);
    liveWait = setTimeout(() => { closeModal(resultModal); playLive(); }, startAt - nowSynced() + 50);
  }

  // Fill modal
  $('result-grade').textContent = result.grade;
  $('result-grade').style.color = result.gradeColor;
  $('result-grade').style.textShadow = `0 0 30px ${result.gradeColor}`;
  $('result-score').textContent = result.score.toLocaleString();
  $('result-sub').textContent = `${result.baseScore} base + ${result.speedBonus} speed bonus`;
  $('rs-found').textContent = result.found;
  $('rs-pct').textContent = result.pct + '%';
  $('rs-bonus').textContent = '+' + result.speedBonus;

  // The targets you didn't get, in their slots and under the score
  result.missed.forEach(w => fillSlot(w, 'missed'));
  $('result-missed').textContent = result.missed.length
    ? 'MISSED: ' + result.missed.map(w => w.toUpperCase()).join(' · ')
    : 'ALL TARGETS FOUND';

  // Best word
  const bestWord = result.wordsFound.sort((a, b) => b.pts - a.pts)[0];
  $('rs-best').textContent = bestWord ? bestWord.word.toUpperCase() : '—';

  // Word chips
  const wordsEl = $('result-words');
  wordsEl.innerHTML = '';
  for (const w of result.wordsFound.sort((a, b) => b.pts - a.pts)) {
    const chip = document.createElement('div');
    chip.className = `rw-chip ${w.rarity}`;
    chip.textContent = w.word.toUpperCase();
    wordsEl.appendChild(chip);
  }

  // Fire victory confetti
  const gridWrap = $('grid-wrap');
  const rect = gridWrap.getBoundingClientRect();
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      renderer.spawnConfetti(
        cx + (Math.random() - 0.5) * 200,
        cy + (Math.random() - 0.5) * 150,
        30
      );
    }, i * 80);
  }

  setTimeout(() => openModal(resultModal), 600);
}

// ── Leaderboard modal ──
function showLeaderboard() {
  const list = $('lb-list');
  list.innerHTML = '';

  // With no score server, only your own best is real, so that is all I show
  const localOnly = [
    { rank:'—', name:'Your best', score: (getStats().bestScore || 0), grade: getStats().grades[0] || '—' },
  ];

  const API_BASE = window.WF_API || '';
  const date = new Date().toISOString().slice(0, 10);

  if (!API_BASE) {
    renderLb(localOnly);
  } else {
    fetch(`${API_BASE}/api/leaderboard/${date}`)
      .then(r => r.json())
      .then(data => renderLb(data.slice(0, 10)))
      .catch(() => renderLb(localOnly));
  }

  function renderLb(rows) {
    for (const row of rows) {
      const el = document.createElement('div');
      el.className = 'lb-row';
      el.setAttribute('role', 'listitem');
      el.innerHTML = `
        <span class="lb-rank${row.rank <= 3 ? ' top' : ''}">${row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}</span>
        <span class="lb-name">${row.name}</span>
        <span class="lb-score">${row.score.toLocaleString()}</span>
        <span class="lb-grade" style="color:${gradeColor(row.grade)}">${row.grade}</span>
      `;
      list.appendChild(el);
    }
  }

  openModal(lbModal);
}

function gradeColor(g) {
  return { A:'#00FF88', B:'#00D4FF', C:'#FFD700', D:'#FF8C42', F:'#FF6B9D' }[g] || '#888';
}

// ── Stats modal ──
function showStats() {
  const s = getStats();
  $('stat-played').textContent = s.played;
  // Badges at 7, 30 and 100 days in a row
  const badge = s.streak >= 100 ? ' 💎' : s.streak >= 30 ? ' ⭐' : s.streak >= 7 ? ' 🏅' : '';
  $('stat-streak').textContent = s.streak + badge;
  $('stat-best-score').textContent = s.bestScore.toLocaleString();
  $('stat-avg').textContent = s.totalCompletion + '%';
  const gh = $('grade-history');
  gh.textContent = s.grades.length ? s.grades.slice(0, 10).join(' ') : '—';
  openModal(statsModal);
}

// ── Share ──
function shareResult() {
  // The daily shares its scored round, never a practice one; endless and live share the round just played.
  // Never the words themselves.
  const daily = UIState.mode !== 'endless' && UIState.mode !== 'live';
  const d = daily ? scoredToday() : UIState.last;
  if (!d) return;
  const site = location.origin + location.pathname;
  let head = 'Word Forge · ', link = site;
  if (daily) head += new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  else if (UIState.mode === 'endless') { head += `Endless #${UIState.endless}`; link = `${site}#endless-${UIState.endless}`; }
  else head += 'Live';
  const rows = d.rows.map(([len, got, of]) => `${len} ${'■'.repeat(got)}${'□'.repeat(of - got)}`);
  const text = [`${head} · ${d.grade}`, ...rows, `${d.score} · ${link}`].join('\n');

  if (navigator.share) {
    navigator.share({ title: 'WordForge', text }).catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
    showToast('Result copied to clipboard!', 'info');
  }
}

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

// ── API submission ──
function submitScore(result) {
  const API_BASE = window.WF_API || '';
  if (!API_BASE) return;
  const userId = getUserId();
  const date = new Date().toISOString().slice(0, 10);
  fetch(`${API_BASE}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      puzzleDate: date,
      score: result.score,
      wordsFound: result.found,
      timeLeft: result.timeLeft,
      grade: result.grade,
    }),
  }).catch(() => {});
}

function getUserId() {
  let id = localStorage.getItem('wf_uid');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('wf_uid', id);
  }
  return id;
}

// ── Ripple effect ──
function addRipple(btn) {
  btn.addEventListener('click', function(e) {
    const r = document.createElement('span');
    r.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.style.width = r.style.height = size + 'px';
    r.style.left = (e.clientX - rect.left - size / 2) + 'px';
    r.style.top  = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(r);
    setTimeout(() => r.remove(), 500);
  });
}

// ── Theme toggle ──
function initTheme() {
  // Check saved preference
  // Only go dark if the user has explicitly chosen it — never auto-apply from OS
  const saved = localStorage.getItem('wf_theme');
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    UIState.darkMode = true;
    $('btn-theme').textContent = '☀️';
  }

  $('btn-theme').addEventListener('click', () => {
    UIState.darkMode = !UIState.darkMode;
    document.body.classList.toggle('dark-mode', UIState.darkMode);
    localStorage.setItem('wf_theme', UIState.darkMode ? 'dark' : 'light');
    $('btn-theme').textContent = UIState.darkMode ? '☀️' : '🌙';
  });

  $('btn-colorblind').addEventListener('click', () => {
    UIState.colorblind = !UIState.colorblind;
    document.body.classList.toggle('colorblind', UIState.colorblind);
    showToast(UIState.colorblind ? 'Colorblind mode on' : 'Colorblind mode off', 'info');
  });
}

// ── Game start flow ──
function startGame(mode = 'daily', opts = {}) {
  stopLiveTimers();
  UIState.mode = mode;
  let seed = WordForgePuzzle.getDailySeed();
  let duration = GAME_DURATION;
  if (mode === 'endless') {
    UIState.endless = opts.n;
    seed = ENDLESS_BASE + opts.n;
    try { localStorage.setItem('wf_endless', String(opts.n + 1)); } catch {}
  } else if (mode === 'live') {
    UIState.liveRound = opts.round;
    seed = LIVE_BASE + opts.round;
    duration = opts.duration;
  }
  const puzzle = game.loadPuzzle(seed);

  // Update UI
  $('total-count').textContent = puzzle.targetWords.length;
  $('found-count').textContent = '0';
  $('progress-bar').style.width = '0%';
  $('score-val').textContent = '0';
  if (document.activeElement) document.activeElement.blur();
  UIState.practice = mode === 'daily' && !!scoredToday();
  $('score-sub').textContent = mode === 'live' ? 'same board for everyone playing now'
    : mode === 'endless' ? puzzle.targetWords.length + ' targets · not scored'
    : UIState.practice ? 'practice · today is already scored'
    : puzzle.targetWords.length + ' targets to find';
  const label = document.querySelector('.score-display .sd-label');
  label.textContent = mode === 'live' ? 'LIVE ROUND' : mode === 'endless' ? `ENDLESS #${opts.n}`
    : UIState.practice ? 'PRACTICE' : 'SCORE';
  label.classList.toggle('practice', mode !== 'daily' || UIState.practice);
  clearWordList();
  buildTargetSlots(puzzle);
  updateTimer(duration);

  // Reset current word display
  updateCurrentWord('');
  $('current-word-text').textContent = '';
  $('cw-hint').textContent = 'DRAG OR TYPE';

  hideStartScreen();
  UIState.gameActive = true;
  game.start(duration);
}

function hideStartScreen() {
  startScreen.style.opacity = '0';
  startScreen.style.pointerEvents = 'none';
  setTimeout(() => startScreen.style.display = 'none', 300);
}

// Back to the menu. Leaving a scored daily round ends it (and shows its result), so nobody can peek and restart.
function showStartScreen() {
  if (game.phase === 'playing' && UIState.mode === 'daily' && !UIState.practice) { game.endGame(); return; }
  stopLiveTimers();
  clearInterval(game.timerInterval);
  game.phase = 'idle';
  closeModal(resultModal);
  renderStartScreen();
  startScreen.style.display = '';
  startScreen.style.opacity = '1';
  startScreen.style.pointerEvents = '';
}

// The result screen's main button: practice the daily, the next endless puzzle, or the next live board
function retryGame() {
  closeModal(resultModal);
  clearWordList();
  if (UIState.mode === 'endless') startGame('endless', { n: UIState.endless >= 999999 ? 1 : UIState.endless + 1 });
  else if (UIState.mode === 'live') playLive();
  else startGame('daily');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  initTheme();
  initRenderer();
  initGame();
  buildAchievementGrid();
  renderStartScreen();
  setInterval(renderStartScreen, 30000);
  syncClock();

  // Button bindings
  $('btn-start').addEventListener('click', () => {
    startGame('daily');
    addRipple($('btn-start'));
  });
  $('btn-endless').addEventListener('click', () => startGame('endless', { n: nextEndless() }));
  $('btn-live').addEventListener('click', playLive);
  $('btn-home').addEventListener('click', showStartScreen);

  $('btn-submit').addEventListener('click', () => {
    if (game && game.phase === 'playing') game.submitCurrentWord();
  });
  addRipple($('btn-submit'));

  $('btn-clear').addEventListener('click', () => {
    if (game) game._clearInput();
  });

  $('btn-retry').addEventListener('click', retryGame);
  $('btn-share').addEventListener('click', shareResult);

  $('btn-leaderboard').addEventListener('click', showLeaderboard);
  $('btn-stats').addEventListener('click', showStats);
  $('btn-help').addEventListener('click', () => openModal(helpModal));

  bindClose('lb-modal',    'lb-close');
  bindClose('stats-modal', 'stats-close');
  bindClose('help-modal',  'help-close');

  // Result modal close on backdrop click
  resultModal.addEventListener('click', e => {
    if (e.target === resultModal) closeModal(resultModal);
  });

  // Sound button; M toggles it too, but only between rounds, since M is a letter in play
  $('btn-sound').textContent = Sound.muted ? '🔇' : '🔊';
  $('btn-sound').setAttribute('aria-label', Sound.muted ? 'Sound off' : 'Sound on');
  $('btn-sound').addEventListener('click', () => Sound.toggle());

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.key === 'm' || e.key === 'M') && game.phase !== 'playing') Sound.toggle();
    if (e.key === 'Escape') {
      closeModal(resultModal);
      closeModal(lbModal);
      closeModal(statsModal);
      closeModal(helpModal);
    }
  });

  // Add ripple to all buttons
  document.querySelectorAll('.btn').forEach(addRipple);

  // Start screen transitions
  startScreen.style.transition = 'opacity 0.3s ease';
});
