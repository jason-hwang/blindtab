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

  async function init() {
    const urlDisplay = document.getElementById('current-url');
    const toggleBtn = document.getElementById('toggle-btn');
    const toggleLabel = document.getElementById('toggle-label');
    const noBanner = document.getElementById('no-password-banner');
    const goOptions = document.getElementById('go-options');
    const goOptionsBanner = document.getElementById('go-options-banner');

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

    const isProtected = protectedUrls.some(u => normalizeUrl(u) === currentUrl);
    updateButton(toggleBtn, toggleLabel, isProtected);
    toggleBtn.disabled = false;

    toggleBtn.addEventListener('click', async () => {
      toggleBtn.disabled = true;
      const { protectedUrls: current = [] } = await chrome.storage.sync.get('protectedUrls');
      let updated;

      if (current.some(u => normalizeUrl(u) === currentUrl)) {
        updated = current.filter(u => normalizeUrl(u) !== currentUrl);
      } else {
        updated = [...current, currentUrl];
      }

      await chrome.storage.sync.set({ protectedUrls: updated });

      // Notify the active tab's content script
      chrome.tabs.sendMessage(tab.id, { type: 'STORAGE_CHANGED' }).catch(() => {});

      const nowProtected = updated.some(u => normalizeUrl(u) === currentUrl);
      updateButton(toggleBtn, toggleLabel, nowProtected);
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

  document.addEventListener('DOMContentLoaded', init);
})();
