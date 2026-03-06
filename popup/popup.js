(() => {
  'use strict';

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
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

  // ── Utilities ──────────────────────────────────────────────────────────────

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function getTabUnlockState(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_UNLOCK_STATE' });
      return response?.unlocked ?? true;
    } catch {
      return true;
    }
  }

  async function removeProtection(tabId, currentUrl) {
    const { protectedUrls: current = [] } = await chrome.storage.sync.get('protectedUrls');
    // Remove whichever entry covers currentUrl (exact or via subpath parent)
    const updated = current.filter(e => !isUrlMatch(e, currentUrl));
    await chrome.storage.sync.set({ protectedUrls: updated });
    chrome.tabs.sendMessage(tabId, { type: 'STORAGE_CHANGED' }).catch(() => {});
  }

  async function init() {
    const urlDisplay = document.getElementById('current-url');
    const toggleBtn = document.getElementById('toggle-btn');
    const toggleLabel = document.getElementById('toggle-label');
    const noBanner = document.getElementById('no-password-banner');
    const goOptions = document.getElementById('go-options');
    const goOptionsBanner = document.getElementById('go-options-banner');
    const subpathSection = document.getElementById('subpath-section');
    const subpathCheckbox = document.getElementById('subpath-checkbox');
    const authSection = document.getElementById('auth-section');
    const authPassword = document.getElementById('auth-password');
    const authConfirmBtn = document.getElementById('auth-confirm-btn');
    const authError = document.getElementById('auth-error');

    // Open options page
    const openOptions = () => chrome.runtime.openOptionsPage();
    goOptions.addEventListener('click', (e) => { e.preventDefault(); openOptions(); });
    goOptionsBanner.addEventListener('click', (e) => { e.preventDefault(); openOptions(); });

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      urlDisplay.textContent = 'Unable to read page URL.';
      return;
    }

    const currentUrl = normalizeUrl(tab.url);
    urlDisplay.textContent = currentUrl;

    // Load storage
    const { protectedUrls = [], passwordHash } = await chrome.storage.sync.get([
      'protectedUrls',
      'passwordHash'
    ]);

    if (!passwordHash) {
      noBanner.classList.remove('hidden');
    }

    const isProtected = protectedUrls.some(e => isUrlMatch(e, currentUrl));
    updateButton(toggleBtn, toggleLabel, isProtected);
    updateSubpathSection(subpathSection, isProtected);
    toggleBtn.disabled = false;

    // ── Auth section: verify password then remove protection ─────────────────

    async function confirmRemoveWithAuth() {
      const password = authPassword.value;
      if (!password) return;

      authConfirmBtn.disabled = true;
      authError.textContent = '';

      const { passwordHash: storedHash } = await chrome.storage.sync.get('passwordHash');
      if (!storedHash) {
        authError.textContent = 'No password set.';
        authConfirmBtn.disabled = false;
        return;
      }

      const inputHash = await sha256(password);
      if (inputHash !== storedHash) {
        authError.textContent = 'Incorrect password.';
        authPassword.value = '';
        authPassword.focus();
        authConfirmBtn.disabled = false;
        return;
      }

      // Password correct: unlock overlay on page, then remove protection
      chrome.tabs.sendMessage(tab.id, { type: 'UNLOCK_AND_REMOVE_OVERLAY' }).catch(() => {});
      await removeProtection(tab.id, currentUrl);

      authSection.classList.add('hidden');
      authPassword.value = '';
      updateButton(toggleBtn, toggleLabel, false);
      updateSubpathSection(subpathSection, false);
      toggleBtn.disabled = false;
    }

    authConfirmBtn.addEventListener('click', confirmRemoveWithAuth);
    authPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmRemoveWithAuth();
    });

    // ── Toggle button ────────────────────────────────────────────────────────

    toggleBtn.addEventListener('click', async () => {
      const { protectedUrls: current = [] } = await chrome.storage.sync.get('protectedUrls');
      const currentlyProtected = current.some(e => isUrlMatch(e, currentUrl));

      // Adding protection — no auth needed
      if (!currentlyProtected) {
        toggleBtn.disabled = true;
        const matchSubpaths = subpathCheckbox.checked;
        const updated = [...current, { url: currentUrl, matchSubpaths }];
        await chrome.storage.sync.set({ protectedUrls: updated });
        chrome.tabs.sendMessage(tab.id, { type: 'STORAGE_CHANGED' }).catch(() => {});
        updateButton(toggleBtn, toggleLabel, true);
        updateSubpathSection(subpathSection, true);
        subpathCheckbox.checked = false;
        toggleBtn.disabled = false;
        return;
      }

      // Removing protection — check if page is currently locked
      const isUnlocked = await getTabUnlockState(tab.id);
      if (!isUnlocked) {
        authSection.classList.remove('hidden');
        authPassword.value = '';
        authError.textContent = '';
        authPassword.focus();
        return;
      }

      // Page already unlocked — allow direct removal
      toggleBtn.disabled = true;
      await removeProtection(tab.id, currentUrl);
      updateButton(toggleBtn, toggleLabel, false);
      updateSubpathSection(subpathSection, false);
      toggleBtn.disabled = false;
    });
  }

  const ICON_LOCKED = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 11H7V8a5 5 0 0 1 10 0v3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.15"/>
    <rect x="5" y="11" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
  </svg>`;

  const ICON_UNLOCKED = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 11H7V8a5 5 0 0 1 10 0" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.15"/>
    <rect x="5" y="11" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
  </svg>`;

  function updateButton(btn, label, isProtected) {
    if (isProtected) {
      btn.className = 'toggle-btn protected';
      label.innerHTML = `${ICON_UNLOCKED}<span>Remove Protection</span>`;
    } else {
      btn.className = 'toggle-btn unprotected';
      label.innerHTML = `${ICON_LOCKED}<span>Protect This Page</span>`;
    }
  }

  function updateSubpathSection(section, isProtected) {
    if (isProtected) {
      section.classList.add('hidden');
    } else {
      section.classList.remove('hidden');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
