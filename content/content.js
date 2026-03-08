(() => {
  'use strict';

  // ── Utilities ──────────────────────────────────────────────────────────────

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      // Remove trailing slash from pathname (keep root "/" as-is unless explicit)
      let pathname = u.pathname.endsWith('/') && u.pathname !== '/'
        ? u.pathname.slice(0, -1)
        : u.pathname;
      return u.origin + pathname + u.search + u.hash;
    } catch {
      return url.replace(/\/$/, '');
    }
  }

  // ── Entry helpers (backward-compat with old string format) ─────────────────

  function entryUrl(entry) {
    return typeof entry === 'string' ? entry : entry.url;
  }

  function entryMatchSubpaths(entry) {
    return typeof entry === 'string' ? false : (entry.matchSubpaths ?? false);
  }

  function isUrlMatch(entry, targetUrl) {
    const base = normalizeUrl(entryUrl(entry));
    if (entryMatchSubpaths(entry)) {
      return targetUrl === base
        || targetUrl.startsWith(base + '/')
        || targetUrl.startsWith(base + '?')
        || targetUrl.startsWith(base + '#');
    }
    return targetUrl === base;
  }

  // ── i18n ───────────────────────────────────────────────────────────────────

  let lang = 'en';

  function t(key) {
    return window.BT_T ? window.BT_T(lang, key) : key;
  }

  async function initLanguage() {
    const { language } = await chrome.storage.sync.get('language');
    if (language) {
      lang = language;
    } else {
      lang = navigator.language.startsWith('ko') ? 'ko' : 'en';
    }
  }

  // ── State ───────────────────────────────────────────────────────────────────

  let unlocked = false;          // Per-tab unlock state (lives in this script context)
  let tempUnlockTimer = null;    // Timer ID for 5-minute temp unlock
  let tempUnlockInterval = null; // Interval ID for countdown display
  let tempUnlockEndTime = null;  // Timestamp (ms) when temp unlock expires

  // ── Overlay ─────────────────────────────────────────────────────────────────

  function createOverlay() {
    if (document.getElementById('bt-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'bt-overlay';

    overlay.innerHTML = `
      <div id="bt-card">
        <svg id="bt-icon" viewBox="0 0 24 24" fill="none"
             xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17 11H7V8a5 5 0 0 1 10 0v3Z" stroke="currentColor"
                stroke-width="1.8" stroke-linejoin="round"/>
          <rect x="5" y="11" width="14" height="10" rx="2.5"
                fill="currentColor" opacity="0.2"/>
          <rect x="5" y="11" width="14" height="10" rx="2.5"
                stroke="currentColor" stroke-width="1.8"/>
          <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
        </svg>
        <p id="bt-title">${t('pageProtected')}</p>
        <p id="bt-subtitle">${t('enterToUnlock')}</p>
        <div id="bt-input-wrap">
          <input
            id="bt-password"
            type="password"
            placeholder="${t('passwordPlaceholder')}"
            autocomplete="current-password"
            spellcheck="false"
          />
          <label id="bt-temp-label">
            <input type="checkbox" id="bt-temp-unlock" />
            <span>${t('keepUnlocked5min')}</span>
          </label>
          <button id="bt-unlock-btn">${t('unlock')}</button>
        </div>
        <p id="bt-error"></p>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    // Bind events after inserting
    const input = overlay.querySelector('#bt-password');
    const btn = overlay.querySelector('#bt-unlock-btn');
    const errorEl = overlay.querySelector('#bt-error');

    btn.addEventListener('click', () => attemptUnlock(input, errorEl));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        attemptUnlock(input, errorEl);
      }
    });

    // Intercept all keyboard events at capture phase so page handlers never fire.
    // Enter is excluded here so it can bubble to the input's own keydown handler.
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') e.stopPropagation();
    }, true);
    overlay.addEventListener('keyup', (e) => {
      e.stopPropagation();
    }, true);
    overlay.addEventListener('keypress', (e) => {
      e.stopPropagation();
    }, true);

    // Refocus input if focus leaves the overlay while it is active
    overlay.addEventListener('focusout', (e) => {
      if (!overlay.contains(e.relatedTarget)) {
        input.focus();
      }
    });

    // Auto-focus immediately; the overlay is already in the DOM at this point
    input.focus();
  }

  function removeOverlay() {
    const overlay = document.getElementById('bt-overlay');
    if (overlay) overlay.remove();
  }

  async function attemptUnlock(input, errorEl) {
    const password = input.value;
    if (!password) return;

    const { passwordHash } = await chrome.storage.sync.get('passwordHash');

    if (!passwordHash) {
      errorEl.textContent = t('noPasswordSetConfig');
      shakeCard();
      return;
    }

    const inputHash = await sha256(password);

    if (inputHash === passwordHash) {
      const isTempUnlock = document.getElementById('bt-temp-unlock')?.checked ?? false;
      unlocked = true;
      input.value = '';
      errorEl.textContent = '';
      removeOverlay();
      if (isTempUnlock) startTempUnlock();
    } else {
      input.value = '';
      errorEl.textContent = t('incorrectPasswordRetry');
      shakeCard();
      input.focus();
    }
  }

  // ── Temp unlock (5-minute timer) ────────────────────────────────────────────

  function startTempUnlock() {
    clearTempUnlock();
    tempUnlockEndTime = Date.now() + 5 * 60 * 1000;
    createFloatingBtn();
    updateFloatingBtnTime();
    tempUnlockInterval = setInterval(updateFloatingBtnTime, 1000);
    tempUnlockTimer = setTimeout(lockPage, 5 * 60 * 1000);
  }

  function clearTempUnlock() {
    if (tempUnlockTimer) {
      clearTimeout(tempUnlockTimer);
      tempUnlockTimer = null;
    }
    if (tempUnlockInterval) {
      clearInterval(tempUnlockInterval);
      tempUnlockInterval = null;
    }
    tempUnlockEndTime = null;
    removeFloatingBtn();
  }

  function updateFloatingBtnTime() {
    const timeEl = document.getElementById('bt-float-time');
    if (!timeEl || tempUnlockEndTime === null) return;
    const remaining = Math.max(0, tempUnlockEndTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function lockPage() {
    clearTempUnlock();
    unlocked = false;
    checkAndProtect(window.location.href);
  }

  // ── Floating re-lock button ──────────────────────────────────────────────────

  function createFloatingBtn() {
    if (document.getElementById('bt-float-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'bt-float-btn';
    btn.setAttribute('aria-label', t('lockPageNow'));
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M17 11H7V8a5 5 0 0 1 10 0v3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" opacity="0.2"/>
        <rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" stroke-width="1.8"/>
        <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      </svg>
      <span id="bt-float-time">5:00</span>
    `;
    btn.addEventListener('click', lockPage);
    document.documentElement.appendChild(btn);
  }

  function removeFloatingBtn() {
    const btn = document.getElementById('bt-float-btn');
    if (btn) btn.remove();
  }

  function shakeCard() {
    const card = document.getElementById('bt-card');
    if (!card) return;
    card.classList.remove('bt-shake');
    // Force reflow to restart animation
    void card.offsetWidth;
    card.classList.add('bt-shake');
    card.addEventListener('animationend', () => card.classList.remove('bt-shake'), { once: true });
  }

  // ── Core check ──────────────────────────────────────────────────────────────

  async function checkAndProtect(url) {
    if (unlocked) return;

    const { protectedUrls = [] } = await chrome.storage.sync.get('protectedUrls');
    const normalized = normalizeUrl(url);
    const isProtected = protectedUrls.some(e => isUrlMatch(e, normalized));

    if (isProtected) {
      // Ensure DOM is ready before inserting overlay
      if (document.documentElement) {
        createOverlay();
      } else {
        document.addEventListener('DOMContentLoaded', createOverlay, { once: true });
      }
    } else {
      removeOverlay();
    }
  }

  // ── SPA navigation detection ─────────────────────────────────────────────────

  function patchHistory() {
    const wrap = (method) => {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        // After pushState/replaceState the URL has changed; re-lock if needed
        clearTempUnlock();
        unlocked = false;
        checkAndProtect(window.location.href);
        return result;
      };
    };
    wrap('pushState');
    wrap('replaceState');
  }

  window.addEventListener('popstate', () => {
    clearTempUnlock();
    unlocked = false;
    checkAndProtect(window.location.href);
  });

  // ── Message listener (from service worker / popup) ──────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CHECK_URL') {
      // Hard navigation detected; reset unlock state for new page context
      clearTempUnlock();
      unlocked = false;
      checkAndProtect(message.url || window.location.href);
    }
    if (message.type === 'STORAGE_CHANGED') {
      // Protected URL list, password, or language changed; re-evaluate
      initLanguage().then(() => checkAndProtect(window.location.href));
      return;
    }
    if (message.type === 'GET_UNLOCK_STATE') {
      // Popup queries whether this tab is currently unlocked
      sendResponse({ unlocked });
      return true;
    }
    if (message.type === 'UNLOCK_AND_REMOVE_OVERLAY') {
      // Popup has verified the password and requests overlay removal
      unlocked = true;
      removeOverlay();
      sendResponse({ ok: true });
      return true;
    }
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  patchHistory();
  initLanguage().then(() => checkAndProtect(window.location.href));
})();
