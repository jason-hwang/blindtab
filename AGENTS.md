# AGENTS.md

Guidelines for AI agents working on the BlindTab codebase.

---

## Project Overview

BlindTab is a **Manifest V3 Chrome extension** written in vanilla JavaScript with no build step. All files are loaded directly by Chrome — there is no bundler, transpiler, or package manager involved.

---

## Key Constraints

| Constraint | Detail |
|------------|--------|
| **No build step** | Do not introduce npm, webpack, Vite, or any bundler unless explicitly asked |
| **No frameworks** | No React, Vue, or other UI frameworks — vanilla JS only |
| **MV3 only** | Do not use MV2 APIs (`background.scripts`, `browser_action`, etc.) |
| **No eval / remote code** | Chrome extensions prohibit `eval` and remotely hosted scripts |
| **Web Crypto only** | Use `crypto.subtle` for hashing — no external crypto libraries |

---

## File Responsibilities

| File | Responsibility |
|------|---------------|
| `content/content.js` | Overlay creation, password verification, SPA navigation patching, message handling |
| `content/content.css` | Overlay visual styles only — all IDs prefixed with `bt-` |
| `background/service-worker.js` | Listens to `chrome.tabs.onUpdated`, sends `CHECK_URL` message to content script |
| `popup/popup.js` | Reads active tab URL, toggles protection state, sends `STORAGE_CHANGED` message |
| `options/options.js` | Password set/change (SHA-256), URL list CRUD |
| `manifest.json` | Permissions, entry points — edit carefully |

---

## Naming Conventions

- **CSS IDs in content script**: always prefixed `bt-` (e.g. `#bt-overlay`, `#bt-card`)
- **CSS animation names**: prefixed `bt-` (e.g. `bt-shake`)
- **CSS classes for state**: prefixed `bt-` (e.g. `.bt-shake`)
- **Message types**: `SCREAMING_SNAKE_CASE` (e.g. `CHECK_URL`, `STORAGE_CHANGED`)

---

## Storage Schema

```json
{
  "passwordHash": "<sha-256 hex string>",
  "protectedUrls": ["https://example.com/page"]
}
```

- `passwordHash` — SHA-256 hex digest of the master password
- `protectedUrls` — array of normalized URL strings (trailing slash stripped)

---

## URL Normalization Rule

```js
function normalizeUrl(url) {
  const u = new URL(url);
  let pathname = u.pathname.endsWith('/') && u.pathname !== '/'
    ? u.pathname.slice(0, -1)
    : u.pathname;
  return u.origin + pathname + u.search + u.hash;
}
```

This function exists identically in `content.js`, `popup.js`, and `options.js`. If you change the normalization logic, update all three.

---

## Message Flow

```
popup.js          →  chrome.tabs.sendMessage  →  content.js
service-worker.js →  chrome.tabs.sendMessage  →  content.js
```

| Message type | Sender | Receiver | Effect |
|--------------|--------|----------|--------|
| `CHECK_URL` | service-worker | content | Re-evaluate current URL against protected list |
| `STORAGE_CHANGED` | popup | content | Re-evaluate after toggle (add/remove URL) |

---

## Design System

BlindTab uses a **utilitarian** visual style:

- Font: `ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace`
- Colors: black `#000000`, white `#ffffff`, gray `#666666` / `#999999`, error red `#cc0000`
- No border-radius (or 0px)
- No box-shadows
- Borders: `1px solid #000000` for structure
- Overlay background: `rgba(0,0,0,0.55)` + `backdrop-filter: blur(18px)`
- Labels: `UPPERCASE` + `letter-spacing: 0.08em`

---

## Testing Checklist

After any change, verify:

1. Load unpacked at `chrome://extensions/` (reload if already loaded)
2. Options page: set password → add a URL → confirm list renders
3. Visit protected URL → overlay appears before page content loads
4. Wrong password → card shakes, error message shown
5. Correct password → overlay removed, page accessible
6. Navigate within same SPA → overlay re-locks
7. Close and reopen tab → overlay re-locks
8. Popup toggle: add URL → visit it → overlay appears; remove URL → reload → no overlay
9. Password change: enter wrong current password → error; correct flow → new password works

---

## What Not to Change Without Discussion

- `"run_at": "document_start"` in `manifest.json` — required for pre-render injection
- `z-index: 2147483647` on `#bt-overlay` — maximum stacking order
- The IIFE wrapper in `content.js` — prevents variable leaks into page scope
- SHA-256 hashing implementation — must match between `content.js` and `options.js`
- `chrome.storage.sync` key names (`passwordHash`, `protectedUrls`) — changing these clears all user data
