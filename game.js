(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const HIGH_SCORE_KEY = 'rewind99-high-score';
  const objectives = [
    'Find three movie tapes, order them by release year, and enter the PIN.',
    'Find the boot disk, insert it into the tower, and crack the password.',
    'Collect 3 tokens, power the cabinet, and recreate the high-score move.',
    'Match the amplifier sliders to the equalizer poster.',
    'Patch the RCA cables, tune the channel, and broadcast the override.'
  ];
  const hints = [
    'The three titles are Jurassic, Titanic, and Matrix. Oldest release goes first.',
    'Something is hiding beneath the turquoise beanbag. The pet starts with “Tama…”',
    'Search low, high, and beside the dance machine. The move is shown on screen.',
    'Read the three poster bars as percentages: low, high, middle.',
    'Match cable colors exactly, then tune to channel 09.'
  ];
  const state = {
    stage: 1, time: 1800, running: false, paused: false, sound: true,
    inventory: [], tapes: [], tokens: 0, seq: [], cables: [], selectedCable: null,
    channel: 3, moves: 0, score: 0
  };
  let timerId = 0;
  let audioCtx;

  function beep(frequency = 500, duration = 0.07, type = 'square') {
    if (!state.sound) return;
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.045, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      oscillator.connect(gain).connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (_) { /* Audio is optional. */ }
  }
  function say(text) { $('#message').textContent = text; beep(390, 0.045); }
  function toast(text, tone = 'normal') {
    const element = $('#toast');
    element.textContent = text;
    element.dataset.tone = tone;
    element.classList.add('show');
    clearTimeout(element._hideTimer);
    element._hideTimer = setTimeout(() => element.classList.remove('show'), 1800);
  }
  function addScore(points) {
    state.score += points;
    renderHUD();
    const popup = document.createElement('span');
    popup.className = 'score-pop';
    popup.textContent = `${points > 0 ? '+' : ''}${points}`;
    $('.screen-frame').appendChild(popup);
    setTimeout(() => popup.remove(), 850);
  }
  function renderInventory() {
    $('#inventory').innerHTML = state.inventory.length
      ? state.inventory.map(item => `<div class="item" data-item="${item.id}"><span><span class="emoji">${item.emoji}</span><br>${item.label}</span></div>`).join('')
      : '<div style="font-size:10px;color:#686786">EMPTY — SEARCH THE ROOM</div>';
  }
  function renderHUD() {
    $('#objective').textContent = objectives[state.stage - 1];
    $('#scoreReadout').textContent = `SCORE ${String(state.score).padStart(6, '0')}`;
    $('#stageDots').innerHTML = objectives.map((_, index) => `<i class="stage-dot ${index + 1 < state.stage ? 'done' : index + 1 === state.stage ? 'current' : ''}"></i>`).join('');
  }
  function addItem(id, label, emoji) {
    if (state.inventory.some(item => item.id === id)) return;
    state.inventory.push({ id, label, emoji });
    renderInventory();
    addScore(100);
    toast(`${label} ADDED TO INVENTORY`);
  }
  function removeItem(id) {
    state.inventory = state.inventory.filter(item => item.id !== id);
    renderInventory();
  }
  function updateTimer() {
    const minutes = Math.floor(state.time / 60);
    const seconds = state.time % 60;
    $('#timer').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    $('#timer').classList.toggle('critical', state.time <= 300);
    if (state.time <= 0) endGame(false);
  }
  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      if (state.running && !state.paused) { state.time -= 1; updateTimer(); }
    }, 1000);
  }
  function setPaused(paused) {
    if (!state.running && !paused) return;
    state.paused = paused;
    $('#pauseOverlay').classList.toggle('hidden', !paused);
    $('#pauseBtn').textContent = paused ? '▶ RESUME' : 'Ⅱ PAUSE';
    if (paused) say('Signal paused. Your progress is safe.');
  }
  function showStage(stage) {
    $$('.stage.active').forEach(element => element.classList.remove('active'));
    $(`#stage${stage}`).classList.add('active');
    renderHUD();
  }
  function nextStage(item) {
    state.running = false;
    addScore(500);
    beep(880, 0.3, 'sawtooth');
    if (item) addItem(item.id, item.label, item.emoji);
    toast('STAGE CLEAR', 'success');
    say('Access granted. Loading the next tape...');
    setTimeout(() => {
      if (item) removeItem(item.id);
      state.stage += 1;
      showStage(state.stage);
      state.running = true;
      say(['', 'Search the room. The computer needs physical media.', 'The redemption machine needs power. Tokens are scattered nearby.', 'That poster looks suspiciously precise. Tune the amp.', 'Restore the studio signal. Cables first, channel second.'][state.stage]);
    }, 700);
  }
  function endGame(won) {
    state.running = false;
    clearInterval(timerId);
    if (!won) { $('#loseOverlay').classList.remove('hidden'); return; }
    state.score += Math.max(0, state.time * 3);
    const previous = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    const highScore = Math.max(previous, state.score);
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    $('#winStats').innerHTML = `The override is live. You escaped 1999 with <b style="color:var(--yellow)">${Math.floor(state.time / 60)}:${String(state.time % 60).padStart(2, '0')}</b> remaining.<br><br>FINAL SCORE: <b style="color:var(--cyan)">${state.score.toLocaleString()}</b> &nbsp;•&nbsp; HIGH SCORE: <b style="color:var(--green)">${highScore.toLocaleString()}</b>`;
    setTimeout(() => $('#winOverlay').classList.remove('hidden'), 450);
  }

  // Stage 1: video store.
  $$('[data-movie]').forEach(tape => tape.addEventListener('click', () => {
    if (tape.classList.contains('found')) return;
    tape.classList.add('found');
    state.tapes.push({ name: tape.dataset.movie, pin: tape.dataset.pin });
    addItem(`tape${tape.dataset.movie}`, `${tape.dataset.movie} VHS`, '📼');
    const slots = $$('.order-slot');
    slots[state.tapes.length - 1].textContent = tape.dataset.movie;
    slots[state.tapes.length - 1].classList.add('full');
    say(`${tape.dataset.movie} found. ${3 - state.tapes.length} featured tape(s) remaining.`);
    if (state.tapes.length === 3) say('All featured tapes found. Order them oldest to newest, then tap the keypad.');
  }));
  $$('[data-decoy]').forEach(tape => tape.addEventListener('click', () => say('A classic, but not one of the featured titles. Keep browsing.')));
  $('#keypad').addEventListener('click', () => {
    if (state.tapes.length < 3) return say('The keypad is locked. Find all three featured tapes first.');
    if (state.tapes.map(tape => tape.name).join(',') !== 'Jurassic,Titanic,Matrix') {
      say('BZZT! Wrong shelf order. Tap the order tray to reset and try again.'); beep(110, 0.3); return;
    }
    $('#pinOverlay').classList.remove('hidden');
    $('#pinInput').value = '';
    $('#pinInput').focus();
  });
  function checkPin() {
    if ($('#pinInput').value.trim() === '9399') {
      $('#pinOverlay').classList.add('hidden');
      nextStage({ id: 'storekey', label: 'STORE KEY', emoji: '🔑' });
    } else { say('ACCESS DENIED. Combine the first movie’s year with the last movie’s year.'); $('#pinInput').select(); beep(100, 0.25); }
  }
  $('#pinSubmit').addEventListener('click', checkPin);
  $('#pinInput').addEventListener('keydown', event => { if (event.key === 'Enter') checkPin(); });
  $('#orderTray').addEventListener('click', () => {
    if (!state.tapes.length) return;
    state.tapes = [];
    $$('[data-movie]').forEach(tape => tape.classList.remove('found'));
    $$('.order-slot').forEach((slot, index) => { slot.textContent = `TAPE ${index + 1}`; slot.classList.remove('full'); });
    state.inventory = state.inventory.filter(item => !item.id.startsWith('tape'));
    renderInventory();
    say('Tapes returned. Select them oldest release first.');
  });

  // Stage 2: bedroom.
  $('#beanbag').addEventListener('click', () => { $('#beanbag').classList.add('moved'); addScore(50); say('You shove the beanbag aside. Something shiny was underneath!'); });
  $('#floppy').addEventListener('click', () => {
    if (!$('#beanbag').classList.contains('moved')) return say('You can’t quite reach it. Move the beanbag first.');
    $('#floppy').classList.add('taken'); addItem('floppy', 'BOOT DISK', '💾'); say('Boot disk acquired. Click the computer tower to insert it.');
  });
  $('#floppy').draggable = true;
  $('#tower').addEventListener('dragover', event => event.preventDefault());
  $('#tower').addEventListener('drop', event => { event.preventDefault(); insertFloppy(); });
  $('#tower').addEventListener('click', insertFloppy);
  function insertFloppy() {
    if (!state.inventory.some(item => item.id === 'floppy')) return say('The tower’s floppy drive is empty. Search the room.');
    removeItem('floppy'); $('#passwordUI').classList.add('show'); say('Disk accepted. Dial-up security asks a very 90s question.'); $('#passwordInput').focus();
  }
  function checkPassword() {
    const value = $('#passwordInput').value.trim().toLowerCase().replace(/\s/g, '');
    if (value === 'tamagotchi') { $('#passwordUI').classList.remove('show'); nextStage({ id: 'modemcode', label: 'MODEM CODE', emoji: '☎️' }); }
    else { say('LOGIN FAILED. Think of the tiny digital pet you had to feed.'); $('#passwordInput').value = ''; beep(100, 0.25); }
  }
  $('#passwordSubmit').addEventListener('click', checkPassword);
  $('#passwordInput').addEventListener('keydown', event => { if (event.key === 'Enter') checkPassword(); });

  // Stage 3: arcade.
  $$('[data-token]').forEach(token => token.addEventListener('click', () => {
    if (token.classList.contains('got')) return;
    token.classList.add('got'); state.tokens += 1; addItem(`token${state.tokens}`, 'ARCADE TOKEN', '🟡'); say(`Token ${state.tokens} of 3 collected.`);
  }));
  $('#scoreCab').addEventListener('click', () => {
    if (state.tokens < 3) return say(`INSERT COIN — ${3 - state.tokens} more token(s) needed.`);
    state.inventory = state.inventory.filter(item => !item.id.startsWith('token')); renderInventory();
    $('#sequenceUI').classList.add('show'); say('Cabinet powered! Recreate the flashing move: Up, Down, Left, Right.');
  });
  $$('[data-dir]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation(); state.seq.push(button.dataset.dir); beep(350 + state.seq.length * 100);
    const target = ['U', 'D', 'L', 'R'];
    if (state.seq.some((value, index) => value !== target[index])) { state.seq = []; say('MISS! Sequence reset. Watch the arrows from left to right.'); beep(100, 0.25); }
    else if (state.seq.length === 4) { $('#sequenceUI').classList.remove('show'); nextStage({ id: 'prizekey', label: 'PRIZE KEY', emoji: '🗝️' }); }
    else say(`Nice! ${state.seq.length}/4 moves locked.`);
  }));

  // Stage 4: amplifier.
  $('#levelRead').innerHTML = '<b></b>'.repeat(10);
  const sliderValues = { bass: 50, treble: 50, gain: 50 };
  $$('[data-slider]').forEach(slider => slider.addEventListener('input', () => {
    sliderValues[slider.dataset.slider] = Number(slider.value);
    slider.parentElement.querySelector('span').textContent = slider.value;
    state.moves += 1;
    const distance = Math.abs(sliderValues.bass - 30) + Math.abs(sliderValues.treble - 70) + Math.abs(sliderValues.gain - 50);
    $$('#levelRead b').forEach((bar, index) => bar.classList.toggle('on', index < Math.max(1, 10 - Math.floor(distance / 15))));
    if (distance === 0) { $('#guitarCase').classList.add('unlocked'); $('#guitarCase').innerHTML = 'FREQUENCY MATCH<br>CLICK TO OPEN'; say('Perfect frequency! The guitar case lock just clicked open.'); beep(660, 0.4, 'sine'); }
    else { $('#guitarCase').classList.remove('unlocked'); $('#guitarCase').innerHTML = 'LOCKED<br>GUITAR CASE'; }
  }));
  $('#guitarCase').addEventListener('click', () => $('#guitarCase').classList.contains('unlocked') ? nextStage({ id: 'keycard', label: 'STUDIO KEYCARD', emoji: '💳' }) : say('An electronic lock responds to the amplifier’s frequency.'));

  // Stage 5: broadcast.
  $$('[data-cable]').forEach(cable => cable.addEventListener('click', () => {
    if (cable.classList.contains('connected')) return;
    $$('[data-cable]').forEach(item => item.classList.remove('selected'));
    cable.classList.add('selected'); state.selectedCable = cable.dataset.cable; say(`${cable.dataset.cable.toUpperCase()} cable selected. Click its matching jack.`);
  }));
  $$('[data-port]').forEach(port => port.addEventListener('click', () => {
    if (!state.selectedCable) return say('Select a loose RCA cable first.');
    if (port.dataset.port !== state.selectedCable) { say('Wrong jack. Match the colors exactly.'); beep(100, 0.25); return; }
    port.classList.add('connected'); $(`[data-cable="${state.selectedCable}"]`).classList.add('connected');
    state.cables.push(state.selectedCable); state.selectedCable = null; beep(550 + state.cables.length * 100); say(`Signal ${state.cables.length}/3 connected.`); checkFinalReady();
  }));
  function setChannel(delta) {
    state.channel += delta;
    if (state.channel > 13) state.channel = 2;
    if (state.channel < 2) state.channel = 13;
    $('#channelNum').textContent = String(state.channel).padStart(2, '0'); beep(120 + state.channel * 15, 0.05); checkFinalReady();
  }
  $('#dialUp').addEventListener('click', () => setChannel(1));
  $('#dialDown').addEventListener('click', () => setChannel(-1));
  function checkFinalReady() {
    const ready = state.cables.length === 3 && state.channel === 9;
    $('#tvScreen').classList.toggle('tuned', ready); $('#broadcastBtn').classList.toggle('show', ready);
    if (ready) say('CHANNEL 09 LOCKED. Signal clean. Broadcast the override!');
    else if (state.cables.length === 3) say('All cables patched. Tune to channel 09.');
  }
  $('#broadcastBtn').addEventListener('click', () => { addScore(1000); beep(900, 0.5, 'sine'); endGame(true); });

  // Global controls, shortcuts, and lifecycle safety.
  $('#startBtn').addEventListener('click', () => { $('#startOverlay').classList.add('hidden'); state.running = true; startTimer(); renderHUD(); say('Three featured VHS tapes hide your exit code. Choose them in release order.'); beep(440, 0.15); });
  $('#playAgainBtn').addEventListener('click', () => window.location.reload());
  $('#resumeBtn').addEventListener('click', () => setPaused(false));
  $('#pauseBtn').addEventListener('click', () => setPaused(!state.paused));
  $('#resetBtn').addEventListener('click', () => { if (window.confirm('REWIND THE ENTIRE GAME? All progress will be lost.')) window.location.reload(); });
  $('#soundBtn').addEventListener('click', () => { state.sound = !state.sound; $('#soundBtn').textContent = `SOUND: ${state.sound ? 'ON' : 'OFF'}`; if (state.sound) beep(500); });
  $('#hintBtn').addEventListener('click', () => { if (!state.running || state.paused) return; state.time = Math.max(0, state.time - 30); updateTimer(); addScore(-50); say(`HINT: ${hints[state.stage - 1]}`); toast('HINT USED — 30 SECONDS LOST', 'warning'); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#pinOverlay').classList.contains('hidden')) setPaused(!state.paused);
    if (event.key.toLowerCase() === 'm') $('#soundBtn').click();
    if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) $('#resetBtn').click();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.running) setPaused(true); });

  renderHUD();
  updateTimer();
  renderInventory();
})();
