(() => {
  'use strict';

  // ── Utilities ──────────────────────────────────────────────────────────────

  // Entry helpers (backward-compat with old string format)
  function entryUrl(entry) {
    return typeof entry === 'string' ? entry : entry.url;
  }

  function entryMatchSubpaths(entry) {
    return typeof entry === 'string' ? false : (entry.matchSubpaths ?? false);
  }

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
      let pathname = u.pathname.endsWith('/') && u.pathname !== '/'
        ? u.pathname.slice(0, -1)
        : u.pathname;
      return u.origin + pathname + u.search + u.hash;
    } catch {
      return url.replace(/\/$/, '');
    }
  }

  function showError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function hideError(el) {
    el.textContent = '';
    el.classList.add('hidden');
  }

  // ── Password section ────────────────────────────────────────────────────────

  async function initPasswordSection() {
    const statusEl = document.getElementById('password-status');
    const currentInput = document.getElementById('current-password');
    const newInput = document.getElementById('new-password');
    const confirmInput = document.getElementById('confirm-password');
    const errorEl = document.getElementById('password-error');
    const saveBtn = document.getElementById('save-password-btn');

    // Show current status
    const { passwordHash } = await chrome.storage.sync.get('passwordHash');
    updatePasswordStatus(statusEl, !!passwordHash);

    saveBtn.addEventListener('click', async () => {
      hideError(errorEl);
      const { passwordHash: stored } = await chrome.storage.sync.get('passwordHash');
      const currentVal = currentInput.value;
      const newVal = newInput.value;
      const confirmVal = confirmInput.value;

      // Validate current password if one exists
      if (stored) {
        if (!currentVal) {
          return showError(errorEl, 'Enter your current password to make changes.');
        }
        const currentHash = await sha256(currentVal);
        if (currentHash !== stored) {
          return showError(errorEl, 'Current password is incorrect.');
        }
      }

      if (!newVal) {
        return showError(errorEl, 'New password cannot be empty.');
      }
      if (newVal.length < 4) {
        return showError(errorEl, 'Password must be at least 4 characters.');
      }
      if (newVal !== confirmVal) {
        return showError(errorEl, 'Passwords do not match.');
      }

      const newHash = await sha256(newVal);
      await chrome.storage.sync.set({ passwordHash: newHash });

      currentInput.value = '';
      newInput.value = '';
      confirmInput.value = '';
      updatePasswordStatus(statusEl, true);

      saveBtn.textContent = '✓ Saved!';
      setTimeout(() => { saveBtn.textContent = 'Save Password'; }, 2000);
    });
  }

  function updatePasswordStatus(el, isSet) {
    if (isSet) {
      el.textContent = 'Password is set.';
      el.className = 'status-banner set';
    } else {
      el.textContent = 'No password set. All protected URLs are inaccessible until you set one.';
      el.className = 'status-banner unset';
    }
  }

  // ── URL section ─────────────────────────────────────────────────────────────

  async function initUrlSection() {
    const urlInput = document.getElementById('url-input');
    const addBtn = document.getElementById('add-url-btn');
    const useCurrentBtn = document.getElementById('use-current-btn');
    const errorEl = document.getElementById('url-error');
    const listEl = document.getElementById('url-list');
    const emptyState = document.getElementById('empty-state');

    // Load existing URLs
    const { protectedUrls = [] } = await chrome.storage.sync.get('protectedUrls');
    renderList(listEl, emptyState, protectedUrls);

    // Fill from current tab
    useCurrentBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        urlInput.value = normalizeUrl(tab.url);
        urlInput.focus();
      }
    });

    // Add URL
    addBtn.addEventListener('click', () => addUrl(urlInput, errorEl, listEl, emptyState));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addUrl(urlInput, errorEl, listEl, emptyState);
    });
  }

  async function addUrl(urlInput, errorEl, listEl, emptyState) {
    hideError(errorEl);
    const raw = urlInput.value.trim();
    if (!raw) return showError(errorEl, 'Please enter a URL.');

    let normalized;
    try {
      normalized = normalizeUrl(new URL(raw).href);
    } catch {
      return showError(errorEl, 'Please enter a valid URL (starting with http:// or https://).');
    }

    const { protectedUrls = [] } = await chrome.storage.sync.get('protectedUrls');
    if (protectedUrls.some(e => normalizeUrl(entryUrl(e)) === normalized)) {
      return showError(errorEl, 'This URL is already in the list.');
    }

    const updated = [...protectedUrls, { url: normalized, matchSubpaths: false }];
    await chrome.storage.sync.set({ protectedUrls: updated });
    urlInput.value = '';
    renderList(listEl, emptyState, updated);
  }

  async function deleteUrl(entry, listEl, emptyState) {
    const { protectedUrls = [] } = await chrome.storage.sync.get('protectedUrls');
    const targetUrl = normalizeUrl(entryUrl(entry));
    const updated = protectedUrls.filter(e => normalizeUrl(entryUrl(e)) !== targetUrl);
    await chrome.storage.sync.set({ protectedUrls: updated });
    renderList(listEl, emptyState, updated);
  }

  function renderList(listEl, emptyState, entries) {
    listEl.innerHTML = '';

    if (entries.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    for (const entry of entries) {
      const li = document.createElement('li');

      const textWrap = document.createElement('span');
      textWrap.className = 'url-text';

      const urlSpan = document.createElement('span');
      urlSpan.textContent = entryUrl(entry);
      textWrap.appendChild(urlSpan);

      if (entryMatchSubpaths(entry)) {
        const badge = document.createElement('span');
        badge.className = 'subpath-badge';
        badge.textContent = '+subpaths';
        textWrap.appendChild(badge);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Remove';
      deleteBtn.addEventListener('click', () => deleteUrl(entry, listEl, emptyState));

      li.appendChild(textWrap);
      li.appendChild(deleteBtn);
      listEl.appendChild(li);
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initPasswordSection();
    initUrlSection();
  });
})();
