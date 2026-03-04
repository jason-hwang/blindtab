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

  // ── State ───────────────────────────────────────────────────────────────────

  let unlocked = false; // Per-tab unlock state (lives in this script context)

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
        <p id="bt-title">This page is protected</p>
        <p id="bt-subtitle">Enter your password to unlock</p>
        <div id="bt-input-wrap">
          <input
            id="bt-password"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            spellcheck="false"
          />
          <button id="bt-unlock-btn">Unlock</button>
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
      if (e.key === 'Enter') attemptUnlock(input, errorEl);
    });

    // Auto-focus after a short delay to avoid being overridden by the page
    setTimeout(() => input.focus(), 100);
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
      errorEl.textContent = 'No password set. Configure in extension options.';
      shakeCard();
      return;
    }

    const inputHash = await sha256(password);

    if (inputHash === passwordHash) {
      unlocked = true;
      input.value = '';
      errorEl.textContent = '';
      removeOverlay();
    } else {
      input.value = '';
      errorEl.textContent = 'Incorrect password. Try again.';
      shakeCard();
      input.focus();
    }
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
    const isProtected = protectedUrls.some(u => normalizeUrl(u) === normalized);

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
        unlocked = false;
        checkAndProtect(window.location.href);
        return result;
      };
    };
    wrap('pushState');
    wrap('replaceState');
  }

  window.addEventListener('popstate', () => {
    unlocked = false;
    checkAndProtect(window.location.href);
  });

  // ── Message listener (from service worker) ──────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'CHECK_URL') {
      // Hard navigation detected; reset unlock state for new page context
      unlocked = false;
      checkAndProtect(message.url || window.location.href);
    }
    if (message.type === 'STORAGE_CHANGED') {
      // Protected URL list or password changed; re-evaluate
      checkAndProtect(window.location.href);
    }
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  patchHistory();
  checkAndProtect(window.location.href);
})();
