/**
 * Eye Relief — Content Script (Forced Green 20-20-20 Overlay)
 *
 * Injects an isolated Shadow DOM top-layer green overlay across web pages
 * whenever the 20-20-20 break phase is active.
 */

(() => {
  if (globalThis.__eyeReliefOverlayInjected) {
    return;
  }
  globalThis.__eyeReliefOverlayInjected = true;

  const HOST_ID = 'eye-relief-overlay-host';
  const RING_RADIUS = 64;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  let currentState = null;
  let isOverlayVisible = false;
  let hostEl = null;
  let shadowRoot = null;
  let refs = null;
  let rafId = null;
  let pollTimeoutId = null;
  let lastSyncAttemptAt = 0;
  let listenersAttached = false;
  let destroyed = false;

  function isContextInvalidatedError(err) {
    const msg = String(err?.message || err || '');
    return msg.includes('Extension context invalidated');
  }

  function cleanupOnInvalidation() {
    destroyed = true;
    if (pollTimeoutId !== null) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    hideOverlay();
  }

  function ensureOverlayDom() {
    if (refs && hostEl) {
      if (!hostEl.isConnected && document.documentElement) {
        document.documentElement.appendChild(hostEl);
      }
      return refs;
    }

    const existing = document.getElementById(HOST_ID);
    if (existing) {
      existing.remove();
    }

    hostEl = document.createElement('div');
    hostEl.id = HOST_ID;
    hostEl.style.cssText = 'all: initial; display: none;';

    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
      }

      .er-backdrop {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 24px;
        border: 0;
        box-sizing: border-box;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(
          circle at 50% 35%,
          rgba(22, 101, 52, 0.96) 0%,
          rgba(15, 61, 35, 0.98) 60%,
          rgba(10, 42, 24, 0.99) 100%
        );
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        color: #ecfdf5;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none;
        -webkit-user-select: none;
        overflow: hidden;
        opacity: 0;
        transition: opacity 220ms ease-out;
      }

      .er-backdrop.is-open {
        opacity: 1;
      }

      .er-backdrop::backdrop {
        background: transparent;
      }

      .er-card {
        width: min(520px, 100%);
        padding: 36px 32px 30px;
        border-radius: 24px;
        background: rgba(6, 44, 24, 0.62);
        border: 1px solid rgba(134, 239, 172, 0.28);
        box-shadow:
          0 24px 64px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(220, 252, 231, 0.14);
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 16px;
      }

      .er-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.18);
        border: 1px solid rgba(134, 239, 172, 0.35);
        color: #bbf7d0;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .er-title {
        margin: 0;
        font-size: clamp(24px, 3.6vw, 32px);
        line-height: 1.2;
        font-weight: 750;
        color: #f0fdf4;
        letter-spacing: -0.02em;
      }

      .er-subtitle {
        margin: 0;
        max-width: 42ch;
        font-size: 15px;
        line-height: 1.55;
        color: #bbf7d0;
      }

      .er-ring-wrap {
        position: relative;
        width: 160px;
        height: 160px;
        margin: 6px 0 2px;
        display: grid;
        place-items: center;
      }

      .er-ring-svg {
        width: 160px;
        height: 160px;
        transform: rotate(-90deg);
      }

      .er-ring-track {
        fill: none;
        stroke: rgba(187, 247, 208, 0.18);
        stroke-width: 10;
      }

      .er-ring-progress {
        fill: none;
        stroke: #4ade80;
        stroke-width: 10;
        stroke-linecap: round;
        transition: stroke-dashoffset 120ms linear;
      }

      .er-countdown-box {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .er-countdown {
        font-size: 42px;
        font-weight: 800;
        line-height: 1;
        color: #ffffff;
        font-variant-numeric: tabular-nums;
      }

      .er-countdown-label {
        margin-top: 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #86efac;
      }

      .er-progress-bar {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: rgba(187, 247, 208, 0.16);
        overflow: hidden;
      }

      .er-progress-fill {
        height: 100%;
        width: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #4ade80 0%, #86efac 100%);
        transition: width 120ms linear;
      }

      .er-tip {
        margin: 0;
        font-size: 13px;
        color: #a7f3d0;
        opacity: 0.92;
      }

      .er-footer {
        width: 100%;
        padding-top: 6px;
        display: flex;
        justify-content: center;
      }

      .er-lock-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 12px;
        background: rgba(5, 46, 22, 0.72);
        border: 1px solid rgba(134, 239, 172, 0.24);
        color: #dcfce7;
        font-size: 13px;
        font-weight: 600;
      }

      .er-skip-btn {
        appearance: none;
        border: 1px solid rgba(187, 247, 208, 0.35);
        background: rgba(255, 255, 255, 0.1);
        color: #ecfdf5;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        padding: 10px 18px;
        border-radius: 12px;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease;
      }

      .er-skip-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(220, 252, 231, 0.6);
      }

      .er-skip-btn:focus-visible {
        outline: 2px solid #86efac;
        outline-offset: 2px;
      }
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'er-backdrop';
    backdrop.setAttribute('popover', 'manual');
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Eye Relief 20-20-20 Break Overlay');

    const card = document.createElement('div');
    card.className = 'er-card';

    const badge = document.createElement('div');
    badge.className = 'er-badge';
    badge.textContent = '20 • 20 • 20 EYE RELIEF';

    const title = document.createElement('h1');
    title.className = 'er-title';
    title.textContent = 'Time to Rest Your Eyes';

    const subtitle = document.createElement('p');
    subtitle.className = 'er-subtitle';
    subtitle.textContent =
      'Look at an object at least 20 feet (6 meters) away until the green screen clears.';

    const ringWrap = document.createElement('div');
    ringWrap.className = 'er-ring-wrap';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'er-ring-svg');
    svg.setAttribute('viewBox', '0 0 160 160');
    svg.setAttribute('aria-hidden', 'true');

    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('class', 'er-ring-track');
    track.setAttribute('cx', '80');
    track.setAttribute('cy', '80');
    track.setAttribute('r', String(RING_RADIUS));

    const progress = document.createElementNS(svgNS, 'circle');
    progress.setAttribute('class', 'er-ring-progress');
    progress.setAttribute('cx', '80');
    progress.setAttribute('cy', '80');
    progress.setAttribute('r', String(RING_RADIUS));
    progress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    progress.style.strokeDashoffset = '0';

    svg.appendChild(track);
    svg.appendChild(progress);

    const countdownBox = document.createElement('div');
    countdownBox.className = 'er-countdown-box';

    const countdownEl = document.createElement('span');
    countdownEl.className = 'er-countdown';
    countdownEl.textContent = '20s';

    const countdownLabel = document.createElement('span');
    countdownLabel.className = 'er-countdown-label';
    countdownLabel.textContent = 'remaining';

    countdownBox.appendChild(countdownEl);
    countdownBox.appendChild(countdownLabel);

    ringWrap.appendChild(svg);
    ringWrap.appendChild(countdownBox);

    const progressBar = document.createElement('div');
    progressBar.className = 'er-progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'er-progress-fill';
    progressBar.appendChild(progressFill);

    const tip = document.createElement('p');
    tip.className = 'er-tip';
    tip.textContent = 'Blink slowly and relax your shoulders';

    const footer = document.createElement('div');
    footer.className = 'er-footer';

    const lockBadge = document.createElement('div');
    lockBadge.className = 'er-lock-badge';
    lockBadge.textContent = '🔒 Forced Break Active — Unlocks automatically at 0s';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'er-skip-btn';
    skipBtn.type = 'button';
    skipBtn.textContent = 'Emergency Skip Break';
    skipBtn.addEventListener('click', async () => {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'SKIP_BREAK' });
        if (res?.state) {
          applyState(res.state);
        }
      } catch (err) {
        if (isContextInvalidatedError(err)) {
          cleanupOnInvalidation();
        }
      }
    });

    footer.appendChild(lockBadge);
    footer.appendChild(skipBtn);

    card.appendChild(badge);
    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(ringWrap);
    card.appendChild(progressBar);
    card.appendChild(tip);
    card.appendChild(footer);

    backdrop.appendChild(card);
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(backdrop);

    if (document.documentElement) {
      document.documentElement.appendChild(hostEl);
    }

    refs = {
      backdrop,
      progress,
      countdownEl,
      progressFill,
      lockBadge,
      skipBtn
    };

    return refs;
  }

  function isEventInsideSkipButton(event) {
    if (!currentState || currentState.strictMode || !refs?.skipBtn) {
      return false;
    }
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.includes(refs.skipBtn);
  }

  function handleBlockedEvent(event) {
    if (!isOverlayVisible) return;
    if (isEventInsideSkipButton(event)) return;
    event.stopPropagation();
    event.preventDefault();
  }

  function attachEventBlockers() {
    if (listenersAttached) return;
    listenersAttached = true;
    const blockedEvents = ['keydown', 'keyup', 'keypress', 'wheel', 'touchmove'];
    for (const eventName of blockedEvents) {
      window.addEventListener(eventName, handleBlockedEvent, { capture: true, passive: false });
    }
  }

  function showOverlay() {
    const dom = ensureOverlayDom();
    attachEventBlockers();

    if (hostEl) {
      hostEl.style.cssText =
        'all: initial !important; position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483647 !important; display: block !important; pointer-events: auto !important;';
    }

    if (!isOverlayVisible) {
      isOverlayVisible = true;
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        try {
          document.activeElement.blur();
        } catch {
          // Ignore blur errors on non-standard elements
        }
      }
    }

    try {
      if (typeof dom.backdrop.showPopover === 'function' && !dom.backdrop.matches(':popover-open')) {
        dom.backdrop.showPopover();
      }
    } catch {
      // Fallback to fixed z-index overlay if Popover API is unavailable
    }

    dom.backdrop.classList.add('is-open');
  }

  function hideOverlay() {
    isOverlayVisible = false;
    if (!refs || !hostEl) return;

    refs.backdrop.classList.remove('is-open');
    try {
      if (typeof refs.backdrop.hidePopover === 'function' && refs.backdrop.matches(':popover-open')) {
        refs.backdrop.hidePopover();
      }
    } catch {
      // Ignore if popover was already closed
    }

    hostEl.style.cssText = 'all: initial !important; display: none !important;';
  }

  function updateBreakVisuals() {
    if (!currentState || !isOverlayVisible || !refs) return;

    const now = Date.now();
    const totalMs = Math.max(1000, currentState.breakDurationSeconds * 1000);
    const remainingMs = Math.max(0, currentState.phaseEndTime - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));

    const offset = RING_CIRCUMFERENCE * (1 - ratio);
    refs.countdownEl.textContent = `${remainingSeconds}s`;
    refs.progress.style.strokeDashoffset = String(offset);
    refs.progressFill.style.width = `${Math.round(ratio * 100)}%`;

    if (currentState.strictMode) {
      refs.lockBadge.style.display = 'inline-flex';
      refs.skipBtn.style.display = 'none';
    } else {
      refs.lockBadge.style.display = 'none';
      refs.skipBtn.style.display = 'inline-flex';
    }
  }

  function scheduleVisualUpdate() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      rafId = null;
      updateBreakVisuals();
    });
  }

  async function requestPhaseSync() {
    if (destroyed) return;
    const now = Date.now();
    if (now - lastSyncAttemptAt < 1000) return;
    lastSyncAttemptAt = now;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_PHASE' });
      if (response?.state) {
        applyState(response.state);
      }
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        cleanupOnInvalidation();
      }
    }
  }

  function scheduleNextTick() {
    if (destroyed) return;
    if (pollTimeoutId !== null) {
      clearTimeout(pollTimeoutId);
    }

    const intervalMs =
      currentState && currentState.enabled && currentState.phase === 'break' ? 200 : 1000;

    pollTimeoutId = setTimeout(async () => {
      await onTick();
    }, intervalMs);
  }

  async function onTick() {
    if (destroyed) return;

    if (!currentState) {
      await loadInitialState();
      scheduleNextTick();
      return;
    }

    if (currentState.enabled && currentState.phase !== 'paused') {
      if (currentState.phase === 'break') {
        scheduleVisualUpdate();
      }

      if (Date.now() >= currentState.phaseEndTime) {
        const isVisible = document.visibilityState === 'visible';
        const gracePassed = Date.now() - currentState.phaseEndTime >= 1500;
        if (isVisible || gracePassed) {
          await requestPhaseSync();
        }
      }
    }

    scheduleNextTick();
  }

  function applyState(state) {
    if (!state || destroyed) return;
    currentState = state;

    const shouldShowBreak = state.enabled && state.phase === 'break' && Date.now() < state.phaseEndTime;
    if (shouldShowBreak) {
      showOverlay();
      scheduleVisualUpdate();
    } else {
      hideOverlay();
      if (state.enabled && state.phase !== 'paused' && Date.now() >= state.phaseEndTime) {
        requestPhaseSync();
      }
    }
  }

  async function loadInitialState() {
    if (destroyed) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNC_PHASE' });
      if (response?.state) {
        applyState(response.state);
        return;
      }
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        cleanupOnInvalidation();
        return;
      }
    }

    try {
      const stored = await chrome.storage.local.get(null);
      if (stored && typeof stored.phase === 'string') {
        applyState(stored);
      }
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        cleanupOnInvalidation();
      }
    }
  }

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local' || destroyed) return;
    try {
      const stored = await chrome.storage.local.get(null);
      if (stored && typeof stored.phase === 'string') {
        applyState(stored);
      }
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        cleanupOnInvalidation();
      }
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && !destroyed) {
      await loadInitialState();
    }
  });

  (async () => {
    await loadInitialState();
    scheduleNextTick();
  })();
})();
