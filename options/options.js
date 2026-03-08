(() => {
  'use strict';

  // ── i18n ───────────────────────────────────────────────────────────────────

  let lang = 'en';

  function t(key) {
    return window.BT_T(lang, key);
  }

  async function detectLanguage() {
    const { language } = await chrome.storage.sync.get('language');
    if (language) return language;
    return navigator.language.startsWith('ko') ? 'ko' : 'en';
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

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

  // ── Language section ───────────────────────────────────────────────────────

  async function initLanguageSection() {
    const select = document.getElementById('language-select');
    select.value = lang;

    select.addEventListener('change', async () => {
      lang = select.value;
      await chrome.storage.sync.set({ language: lang });
      applyTranslations();
      // Notify all content scripts to reload language
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'STORAGE_CHANGED' }).catch(() => {});
      });
      // Re-render dynamic sections to apply new language
      const statusEl = document.getElementById('password-status');
      const { passwordHash } = await chrome.storage.sync.get('passwordHash');
      updatePasswordStatus(statusEl, !!passwordHash);
      const { protectedUrls = [] } = await chrome.storage.sync.get('protectedUrls');
      renderList(
        document.getElementById('url-list'),
        document.getElementById('empty-state'),
        protectedUrls
      );
    });
  }

  // ── Password section ────────────────────────────────────────────────────────

  async function initPasswordSection() {
    const statusEl = document.getElementById('password-status');
    const currentInput = document.getElementById('current-password');
    const newInput = document.getElementById('new-password');
    const confirmInput = document.getElementById('confirm-password');
    const errorEl = document.getElementById('password-error');
    const saveBtn = document.getElementById('save-password-btn');

    const { passwordHash } = await chrome.storage.sync.get('passwordHash');
    updatePasswordStatus(statusEl, !!passwordHash);

    saveBtn.addEventListener('click', async () => {
      hideError(errorEl);
      const { passwordHash: stored } = await chrome.storage.sync.get('passwordHash');
      const currentVal = currentInput.value;
      const newVal = newInput.value;
      const confirmVal = confirmInput.value;

      if (stored) {
        if (!currentVal) return showError(errorEl, t('errEnterCurrent'));
        const currentHash = await sha256(currentVal);
        if (currentHash !== stored) return showError(errorEl, t('errCurrentIncorrect'));
      }

      if (!newVal)            return showError(errorEl, t('errNewEmpty'));
      if (newVal.length < 4)  return showError(errorEl, t('errTooShort'));
      if (newVal !== confirmVal) return showError(errorEl, t('errNoMatch'));

      const newHash = await sha256(newVal);
      await chrome.storage.sync.set({ passwordHash: newHash });

      currentInput.value = '';
      newInput.value = '';
      confirmInput.value = '';
      updatePasswordStatus(statusEl, true);

      saveBtn.textContent = t('saved');
      setTimeout(() => { saveBtn.textContent = t('savePassword'); }, 2000);
    });
  }

  function updatePasswordStatus(el, isSet) {
    if (isSet) {
      el.textContent = t('passwordIsSet');
      el.className = 'status-banner set';
    } else {
      el.textContent = t('noPasswordSetWarning');
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

    const { protectedUrls = [] } = await chrome.storage.sync.get('protectedUrls');
    renderList(listEl, emptyState, protectedUrls);

    useCurrentBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        urlInput.value = normalizeUrl(tab.url);
        urlInput.focus();
      }
    });

    addBtn.addEventListener('click', () => addUrl(urlInput, errorEl, listEl, emptyState));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addUrl(urlInput, errorEl, listEl, emptyState);
    });
  }

  async function addUrl(urlInput, errorEl, listEl, emptyState) {
    hideError(errorEl);
    const raw = urlInput.value.trim();
    if (!raw) return showError(errorEl, t('errEnterUrl'));

    let normalized;
    try {
      normalized = normalizeUrl(new URL(raw).href);
    } catch {
      return showError(errorEl, t('errInvalidUrl'));
    }

    const { protectedUrls = [] } = await chrome.storage.sync.get('protectedUrls');
    if (protectedUrls.some(e => normalizeUrl(entryUrl(e)) === normalized)) {
      return showError(errorEl, t('errUrlExists'));
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
      deleteBtn.textContent = t('removeUrl');
      deleteBtn.addEventListener('click', () => deleteUrl(entry, listEl, emptyState));

      li.appendChild(textWrap);
      li.appendChild(deleteBtn);
      listEl.appendChild(li);
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', async () => {
    lang = await detectLanguage();
    applyTranslations();
    await initLanguageSection();
    initPasswordSection();
    initUrlSection();
  });
})();
