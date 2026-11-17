/**
 * Eye Relief — Popup UI Controller
 *
 * Uses async/await exclusively with requestAnimationFrame for timer ring updates.
 */

const RING_RADIUS = 58;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const elements = {
  enabledToggle: document.getElementById('enabledToggle'),
  phasePill: document.getElementById('phasePill'),
  timerRing: document.getElementById('timerRing'),
  timerDisplay: document.getElementById('timerDisplay'),
  timerCaption: document.getElementById('timerCaption'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  forceOverlayBtn: document.getElementById('forceOverlayBtn'),
  workMinutesInput: document.getElementById('workMinutesInput'),
  breakSecondsInput: document.getElementById('breakSecondsInput'),
  strictModeToggle: document.getElementById('strictModeToggle'),
  soundEnabledToggle: document.getElementById('soundEnabledToggle'),
  breaksTodayText: document.getElementById('breaksTodayText')
};

let latestState = null;
let renderFrameId = null;
let lastSyncAt = 0;

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function renderState() {
  if (!latestState) return;
  const state = latestState;
  const now = Date.now();

  elements.enabledToggle.checked = Boolean(state.enabled);
  elements.strictModeToggle.checked = Boolean(state.strictMode);
  elements.soundEnabledToggle.checked = state.soundEnabled !== false;

  if (document.activeElement !== elements.workMinutesInput) {
    elements.workMinutesInput.value = String(state.workDurationMinutes);
  }
  if (document.activeElement !== elements.breakSecondsInput) {
    elements.breakSecondsInput.value = String(state.breakDurationSeconds);
  }

  elements.breaksTodayText.textContent = `Breaks completed today: ${state.completedBreaksToday || 0}`;

  elements.timerRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);

  if (!state.enabled) {
    elements.phasePill.textContent = 'Disabled';
    elements.phasePill.className = 'phase-pill phase-paused';
    elements.timerDisplay.textContent = formatClock(state.workDurationMinutes * 60);
    elements.timerCaption.textContent = 'turn on to track screen time';
    elements.timerRing.style.stroke = '#64748b';
    elements.timerRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    elements.pauseBtn.textContent = 'Pause';
    elements.pauseBtn.disabled = true;
    elements.forceOverlayBtn.disabled = false;
    return;
  }

  elements.pauseBtn.disabled = false;

  if (state.phase === 'paused') {
    const remainingMs = state.remainingMsWhenPaused ?? state.workDurationMinutes * 60 * 1000;
    const totalMs = Math.max(1000, state.workDurationMinutes * 60 * 1000);
    const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));

    elements.phasePill.textContent = 'Paused';
    elements.phasePill.className = 'phase-pill phase-paused';
    elements.timerDisplay.textContent = formatClock(remainingMs / 1000);
    elements.timerCaption.textContent = 'timer paused';
    elements.timerRing.style.stroke = '#94a3b8';
    elements.timerRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
    elements.pauseBtn.textContent = 'Resume';
    elements.forceOverlayBtn.disabled = false;
    return;
  }

  if (state.phase === 'break') {
    const remainingMs = Math.max(0, state.phaseEndTime - now);
    const totalMs = Math.max(1000, state.breakDurationSeconds * 1000);
    const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));

    elements.phasePill.textContent = 'Resting Eyes';
    elements.phasePill.className = 'phase-pill phase-break';
    elements.timerDisplay.textContent = formatClock(remainingMs / 1000);
    elements.timerCaption.textContent = 'green overlay active';
    elements.timerRing.style.stroke = '#86efac';
    elements.timerRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
    elements.pauseBtn.textContent = 'Pause';
    elements.pauseBtn.disabled = state.strictMode;
    elements.forceOverlayBtn.disabled = true;
    return;
  }

  // Working phase
  const remainingMs = Math.max(0, state.phaseEndTime - now);
  const totalMs = Math.max(1000, state.workDurationMinutes * 60 * 1000);
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));

  elements.phasePill.textContent = 'Screen Time';
  elements.phasePill.className = 'phase-pill phase-working';
  elements.timerDisplay.textContent = formatClock(remainingMs / 1000);
  elements.timerCaption.textContent = 'until green break';
  elements.timerRing.style.stroke = '#4ade80';
  elements.timerRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));
  elements.pauseBtn.textContent = 'Pause';
  elements.forceOverlayBtn.disabled = false;
}

function scheduleRender() {
  if (renderFrameId !== null) {
    cancelAnimationFrame(renderFrameId);
  }
  renderFrameId = requestAnimationFrame(() => {
    renderFrameId = null;
    renderState();
  });
}

async function sendMessage(payload) {
  try {
    const response = await chrome.runtime.sendMessage(payload);
    if (response?.state) {
      latestState = response.state;
      scheduleRender();
    }
    return response;
  } catch (err) {
    console.error('Eye Relief popup: message error', err);
    return null;
  }
}

async function commitSettings() {
  const workMinutes = Number(elements.workMinutesInput.value);
  const breakSeconds = Number(elements.breakSecondsInput.value);

  await sendMessage({
    type: 'UPDATE_SETTINGS',
    settings: {
      enabled: elements.enabledToggle.checked,
      strictMode: elements.strictModeToggle.checked,
      soundEnabled: elements.soundEnabledToggle.checked,
      workDurationMinutes: Number.isFinite(workMinutes) ? workMinutes : 20,
      breakDurationSeconds: Number.isFinite(breakSeconds) ? breakSeconds : 20
    }
  });
}

function bindEvents() {
  elements.enabledToggle.addEventListener('change', async () => {
    await commitSettings();
  });

  elements.strictModeToggle.addEventListener('change', async () => {
    await commitSettings();
  });

  elements.soundEnabledToggle.addEventListener('change', async () => {
    await commitSettings();
  });

  elements.workMinutesInput.addEventListener('change', async () => {
    await commitSettings();
  });

  elements.breakSecondsInput.addEventListener('change', async () => {
    await commitSettings();
  });

  elements.pauseBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'TOGGLE_PAUSE' });
  });

  elements.resetBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'RESET_TIMER' });
  });

  elements.forceOverlayBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'START_BREAK_NOW' });
  });

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local') return;
    try {
      const stored = await chrome.storage.local.get(null);
      if (stored && typeof stored.phase === 'string') {
        latestState = stored;
        scheduleRender();
      }
    } catch (err) {
      console.error('Eye Relief popup: storage read error', err);
    }
  });
}

async function initPopup() {
  bindEvents();
  await sendMessage({ type: 'SYNC_PHASE' });

  setInterval(async () => {
    if (!latestState) return;
    scheduleRender();

    const now = Date.now();
    if (
      latestState.enabled &&
      latestState.phase !== 'paused' &&
      now >= latestState.phaseEndTime &&
      now - lastSyncAt > 800
    ) {
      lastSyncAt = now;
      await sendMessage({ type: 'SYNC_PHASE' });
    }
  }, 250);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initPopup();
});
