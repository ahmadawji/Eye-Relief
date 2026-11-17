/**
 * Eye Relief — Manifest V3 Background Service Worker
 *
 * Manages the 20-20-20 timer state entirely in chrome.storage.local
 * and uses chrome.alarms so state survives service worker restarts.
 */

const PHASE_ALARM_NAME = 'eye-relief-phase';
const BADGE_ALARM_NAME = 'eye-relief-badge';
const BREAK_NOTIFICATION_ID = 'eye-relief-break';
const BREAK_END_NOTIFICATION_ID = 'eye-relief-break-end';
const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';
const WAKE_GRACE_MS = 5 * 60 * 1000;

const DEFAULT_WORK_MINUTES = 20;
const DEFAULT_BREAK_SECONDS = 20;

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function createFreshState(now, overrides = {}) {
  const workDurationMinutes = clampInt(
    overrides.workDurationMinutes,
    1,
    120,
    DEFAULT_WORK_MINUTES
  );
  const breakDurationSeconds = clampInt(
    overrides.breakDurationSeconds,
    5,
    300,
    DEFAULT_BREAK_SECONDS
  );
  return {
    enabled: typeof overrides.enabled === 'boolean' ? overrides.enabled : true,
    phase: overrides.phase || 'working',
    phaseStartTime: typeof overrides.phaseStartTime === 'number' ? overrides.phaseStartTime : now,
    phaseEndTime:
      typeof overrides.phaseEndTime === 'number'
        ? overrides.phaseEndTime
        : now + workDurationMinutes * 60 * 1000,
    remainingMsWhenPaused:
      typeof overrides.remainingMsWhenPaused === 'number' ? overrides.remainingMsWhenPaused : null,
    workDurationMinutes,
    breakDurationSeconds,
    strictMode: typeof overrides.strictMode === 'boolean' ? overrides.strictMode : true,
    soundEnabled: typeof overrides.soundEnabled === 'boolean' ? overrides.soundEnabled : true,
    completedBreaksToday:
      typeof overrides.completedBreaksToday === 'number' ? overrides.completedBreaksToday : 0,
    statsDate: typeof overrides.statsDate === 'string' ? overrides.statsDate : getTodayString()
  };
}

async function getState() {
  const now = Date.now();
  const today = getTodayString();
  const stored = await chrome.storage.local.get(null);

  const hasValidState =
    stored &&
    typeof stored.phase === 'string' &&
    typeof stored.phaseStartTime === 'number' &&
    typeof stored.phaseEndTime === 'number';

  if (!hasValidState) {
    const initial = createFreshState(now, { ...stored, statsDate: today });
    await chrome.storage.local.set(initial);
    return initial;
  }

  const normalized = createFreshState(now, stored);
  if (normalized.statsDate !== today) {
    normalized.completedBreaksToday = 0;
    normalized.statsDate = today;
    await chrome.storage.local.set({
      completedBreaksToday: 0,
      statsDate: today
    });
  }

  return normalized;
}

async function scheduleAlarms(state) {
  try {
    await chrome.alarms.clear(PHASE_ALARM_NAME);
    if (!state.enabled || state.phase === 'paused') {
      await chrome.alarms.clear(BADGE_ALARM_NAME);
      return;
    }

    const triggerAt = Math.max(Date.now() + 500, state.phaseEndTime);
    await chrome.alarms.create(PHASE_ALARM_NAME, { when: triggerAt });

    const existingBadgeAlarm = await chrome.alarms.get(BADGE_ALARM_NAME);
    if (!existingBadgeAlarm) {
      await chrome.alarms.create(BADGE_ALARM_NAME, { periodInMinutes: 0.5 });
    }
  } catch (err) {
    console.error('Eye Relief: failed to schedule alarms', err);
  }
}

async function updateBadge(state) {
  try {
    if (!state.enabled || state.phase === 'paused') {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
      return;
    }

    if (state.phase === 'break') {
      await chrome.action.setBadgeText({ text: 'BRK' });
      await chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
      return;
    }

    const remainingMs = Math.max(0, state.phaseEndTime - Date.now());
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    await chrome.action.setBadgeText({ text: `${remainingMinutes}m` });
    await chrome.action.setBadgeBackgroundColor({ color: '#15803d' });
  } catch (err) {
    console.error('Eye Relief: failed to update badge', err);
  }
}

async function ensureOffscreenDocument() {
  try {
    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
    if (typeof chrome.runtime.getContexts === 'function') {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
      });
      if (existingContexts.length > 0) {
        return;
      }
    }

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play the 20-20-20 break notification chime when screen time expires.'
    });
  } catch (err) {
    // Ignore "Only a single offscreen document may be created." if created concurrently
    if (!String(err?.message || '').includes('single offscreen')) {
      console.error('Eye Relief: failed to create offscreen document', err);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playNotificationSound(soundKey) {
  await ensureOffscreenDocument();

  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'PLAY_NOTIFICATION_SOUND',
        sound: soundKey
      });
      if (response && response.ok === false) {
        console.error(`Eye Relief: offscreen audio failed (${soundKey}):`, response.error);
      }
      return;
    } catch (err) {
      const msg = String(err?.message || err || '');
      const isNotReady =
        msg.includes('Receiving end does not exist') ||
        msg.includes('Could not establish connection');
      if (isNotReady && attempt < maxAttempts) {
        await sleep(60 * attempt);
        continue;
      }
      console.error(`Eye Relief: failed to play ${soundKey} sound`, err);
      return;
    }
  }
}

async function notifyBreakStarted(state) {
  try {
    await chrome.notifications.clear(BREAK_END_NOTIFICATION_ID);
    await chrome.notifications.create(BREAK_NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Eye Relief — Time for a 20-20-20 Break',
      message: `Look 20 feet away for ${state.breakDurationSeconds} seconds while the green overlay is active.`,
      silent: true
    });
  } catch (err) {
    console.error('Eye Relief: failed to show break-start notification', err);
  }

  if (state.soundEnabled) {
    await playNotificationSound('break-start');
  }
}

async function notifyBreakEnded(state) {
  await clearBreakNotification();
  try {
    await chrome.notifications.create(BREAK_END_NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Eye Relief — Break Complete',
      message: `Your eyes are rested. Next break in ${state.workDurationMinutes} min.`,
      silent: true
    });
  } catch (err) {
    console.error('Eye Relief: failed to show break-end notification', err);
  }

  if (state.soundEnabled) {
    await playNotificationSound('break-end');
  }
}

async function clearBreakNotification() {
  try {
    await chrome.notifications.clear(BREAK_NOTIFICATION_ID);
  } catch (err) {
    console.error('Eye Relief: failed to clear notification', err);
  }
}

async function persistAndSyncEffects(nextState) {
  await chrome.storage.local.set(nextState);
  await scheduleAlarms(nextState);
  await updateBadge(nextState);
  return nextState;
}

async function syncPhase() {
  let state = await getState();
  if (!state.enabled || state.phase === 'paused') {
    await updateBadge(state);
    return state;
  }

  const now = Date.now();
  if (now >= state.phaseEndTime) {
    let enteredBreak = false;
    let exitedBreak = false;

    if (state.phase === 'working') {
      if (now - state.phaseEndTime > WAKE_GRACE_MS) {
        state = {
          ...state,
          phase: 'working',
          phaseStartTime: now,
          phaseEndTime: now + state.workDurationMinutes * 60 * 1000,
          remainingMsWhenPaused: null
        };
      } else {
        enteredBreak = true;
        state = {
          ...state,
          phase: 'break',
          phaseStartTime: now,
          phaseEndTime: now + state.breakDurationSeconds * 1000,
          remainingMsWhenPaused: null
        };
      }
    } else if (state.phase === 'break') {
      exitedBreak = true;
      state = {
        ...state,
        phase: 'working',
        phaseStartTime: now,
        phaseEndTime: now + state.workDurationMinutes * 60 * 1000,
        remainingMsWhenPaused: null,
        completedBreaksToday: state.completedBreaksToday + 1,
        statsDate: getTodayString()
      };
    }

    const saved = await persistAndSyncEffects(state);
    if (enteredBreak) {
      await notifyBreakStarted(saved);
    } else if (exitedBreak) {
      await notifyBreakEnded(saved);
    }
    return saved;
  }

  await updateBadge(state);
  return state;
}

async function startBreakNow() {
  const state = await getState();
  const now = Date.now();
  const nextState = {
    ...state,
    enabled: true,
    phase: 'break',
    phaseStartTime: now,
    phaseEndTime: now + state.breakDurationSeconds * 1000,
    remainingMsWhenPaused: null
  };
  const saved = await persistAndSyncEffects(nextState);
  await notifyBreakStarted(saved);
  return saved;
}

async function skipBreak() {
  const state = await getState();
  if (state.strictMode) {
    return { skipped: false, state };
  }
  const now = Date.now();
  const nextState = {
    ...state,
    phase: 'working',
    phaseStartTime: now,
    phaseEndTime: now + state.workDurationMinutes * 60 * 1000,
    remainingMsWhenPaused: null
  };
  const saved = await persistAndSyncEffects(nextState);
  await clearBreakNotification();
  return { skipped: true, state: saved };
}

async function resetTimer() {
  const state = await getState();
  const now = Date.now();
  const nextState = {
    ...state,
    enabled: true,
    phase: 'working',
    phaseStartTime: now,
    phaseEndTime: now + state.workDurationMinutes * 60 * 1000,
    remainingMsWhenPaused: null
  };
  const saved = await persistAndSyncEffects(nextState);
  await clearBreakNotification();
  return saved;
}

async function togglePause() {
  const state = await getState();
  const now = Date.now();

  if (state.phase === 'paused') {
    const resumeMs =
      typeof state.remainingMsWhenPaused === 'number' && state.remainingMsWhenPaused > 0
        ? state.remainingMsWhenPaused
        : state.workDurationMinutes * 60 * 1000;
    const nextState = {
      ...state,
      enabled: true,
      phase: 'working',
      phaseStartTime: now,
      phaseEndTime: now + resumeMs,
      remainingMsWhenPaused: null
    };
    return await persistAndSyncEffects(nextState);
  }

  const remaining = Math.max(1000, state.phaseEndTime - now);
  const nextState = {
    ...state,
    phase: 'paused',
    remainingMsWhenPaused: remaining
  };
  return await persistAndSyncEffects(nextState);
}

async function updateSettings(settings = {}) {
  const state = await getState();
  const now = Date.now();

  const nextEnabled =
    typeof settings.enabled === 'boolean' ? settings.enabled : state.enabled;
  const nextStrictMode =
    typeof settings.strictMode === 'boolean' ? settings.strictMode : state.strictMode;
  const nextSoundEnabled =
    typeof settings.soundEnabled === 'boolean' ? settings.soundEnabled : state.soundEnabled;
  const nextWorkMinutes =
    settings.workDurationMinutes !== undefined
      ? clampInt(settings.workDurationMinutes, 1, 120, state.workDurationMinutes)
      : state.workDurationMinutes;
  const nextBreakSeconds =
    settings.breakDurationSeconds !== undefined
      ? clampInt(settings.breakDurationSeconds, 5, 300, state.breakDurationSeconds)
      : state.breakDurationSeconds;

  let nextPhase = state.phase;
  let nextStart = state.phaseStartTime;
  let nextEnd = state.phaseEndTime;
  let nextRemainingPaused = state.remainingMsWhenPaused;

  if (!state.enabled && nextEnabled) {
    nextPhase = 'working';
    nextStart = now;
    nextEnd = now + nextWorkMinutes * 60 * 1000;
    nextRemainingPaused = null;
  } else if (nextEnabled && nextWorkMinutes !== state.workDurationMinutes) {
    const newWorkMs = nextWorkMinutes * 60 * 1000;
    if (nextPhase === 'working') {
      const elapsed = Math.max(0, now - state.phaseStartTime);
      if (newWorkMs <= elapsed) {
        nextStart = now;
        nextEnd = now + newWorkMs;
      } else {
        nextEnd = state.phaseStartTime + newWorkMs;
      }
    } else if (nextPhase === 'paused') {
      nextRemainingPaused = Math.min(nextRemainingPaused ?? newWorkMs, newWorkMs);
    }
  }

  if (nextEnabled && nextBreakSeconds !== state.breakDurationSeconds && nextPhase === 'break') {
    const newBreakMs = nextBreakSeconds * 1000;
    nextEnd = Math.max(now + 1000, state.phaseStartTime + newBreakMs);
  }

  const nextState = {
    ...state,
    enabled: nextEnabled,
    strictMode: nextStrictMode,
    soundEnabled: nextSoundEnabled,
    workDurationMinutes: nextWorkMinutes,
    breakDurationSeconds: nextBreakSeconds,
    phase: nextPhase,
    phaseStartTime: nextStart,
    phaseEndTime: nextEnd,
    remainingMsWhenPaused: nextRemainingPaused
  };

  return await persistAndSyncEffects(nextState);
}

async function injectContentScriptIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (typeof tab.id !== 'number') continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/overlay.js']
        });
      } catch {
        // Ignore restricted URLs (chrome://, edge://, Chrome Web Store, unloaded tabs)
      }
    }
  } catch (err) {
    console.error('Eye Relief: failed to query open tabs on install', err);
  }
}

// Register all listeners synchronously at top level
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const state = await getState();
    await scheduleAlarms(state);
    await updateBadge(state);
    await injectContentScriptIntoOpenTabs();
  } catch (err) {
    console.error('Eye Relief: onInstalled failed', err);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const state = await getState();
    const now = Date.now();
    const nextState = {
      ...state,
      phase: state.phase === 'paused' ? 'paused' : 'working',
      phaseStartTime: now,
      phaseEndTime: now + state.workDurationMinutes * 60 * 1000,
      remainingMsWhenPaused: state.phase === 'paused' ? state.remainingMsWhenPaused : null
    };
    await persistAndSyncEffects(nextState);
  } catch (err) {
    console.error('Eye Relief: onStartup failed', err);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === PHASE_ALARM_NAME || alarm.name === BADGE_ALARM_NAME) {
      await syncPhase();
    }
  } catch (err) {
    console.error('Eye Relief: onAlarm failed', err);
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  try {
    const state = await getState();
    await updateBadge(state);
  } catch (err) {
    console.error('Eye Relief: storage.onChanged badge update failed', err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case 'GET_STATE':
        case 'SYNC_PHASE': {
          const state = await syncPhase();
          sendResponse({ ok: true, state });
          break;
        }
        case 'START_BREAK_NOW': {
          const state = await startBreakNow();
          sendResponse({ ok: true, state });
          break;
        }
        case 'SKIP_BREAK': {
          const result = await skipBreak();
          sendResponse({ ok: result.skipped, state: result.state });
          break;
        }
        case 'END_BREAK': {
          const state = await syncPhase();
          sendResponse({ ok: true, state });
          break;
        }
        case 'RESET_TIMER': {
          const state = await resetTimer();
          sendResponse({ ok: true, state });
          break;
        }
        case 'TOGGLE_PAUSE': {
          const state = await togglePause();
          sendResponse({ ok: true, state });
          break;
        }
        case 'UPDATE_SETTINGS': {
          const state = await updateSettings(message.settings || {});
          sendResponse({ ok: true, state });
          break;
        }
        default: {
          const state = await getState();
          sendResponse({ ok: false, error: 'Unknown message type', state });
        }
      }
    } catch (err) {
      console.error('Eye Relief: message handler failed', err);
      sendResponse({ ok: false, error: err?.message || 'Internal error' });
    }
  })();
  return true;
});
