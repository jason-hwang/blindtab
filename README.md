# BlindTab

A Chrome extension that protects specific URLs with a password-locked overlay. Visit a protected page and it's immediately covered — unlock it per tab, and it re-locks on navigation or when the tab is closed.

---

## Features

- **Instant overlay** — injected at `document_start`, before the page renders
- **Per-tab unlock** — unlocking one tab does not affect others
- **Auto re-lock** — re-locks on any navigation (including SPA `pushState` / `popstate`)
- **SHA-256 password** — password stored as a hash in `chrome.storage.sync`, never in plaintext
- **Quick toggle** — enable/disable protection for the current page directly from the popup
- **Full management** — add/remove URLs and change password via the options page

---

## Installation

No build step required.

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. The BlindTab icon will appear in your toolbar

---

## Setup

1. Click the BlindTab icon → **Manage all protected URLs →**
2. In the **Password** section, set your password (required before any URL can be unlocked)
3. In the **Protected URLs** section, add URLs you want to protect
4. Visit a protected URL — the overlay appears immediately

---

## Usage

### Popup
| Action | Result |
|--------|--------|
| Click **Protect This Page** | Adds the current URL to the protected list |
| Click **Remove Protection** | Removes the current URL from the protected list |
| Click **Manage all protected URLs** | Opens the options page |

### Overlay
| Action | Result |
|--------|--------|
| Enter correct password + Enter or **Unlock** | Removes overlay for this tab |
| Enter wrong password | Input clears, card shakes, error shown |
| Navigate to another URL | Overlay re-locks automatically |
| Close and reopen tab | Overlay re-locks automatically |

### Options page
- **Password section** — set or change the master password (current password required to change)
- **Protected URLs section** — add URLs manually or fill from current tab; remove individually

---

## Project Structure

```
blindtab/
├── manifest.json                 — MV3 manifest
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content/
│   ├── content.js                — Overlay injection, unlock logic, SPA detection
│   └── content.css               — Overlay styles (utilitarian)
├── background/
│   └── service-worker.js         — Tab navigation listener
├── popup/
│   ├── popup.html
│   ├── popup.js                  — Current tab toggle
│   └── popup.css
└── options/
    ├── options.html
    ├── options.js                — Password management + URL list
    └── options.css
```

---

## Technical Notes

**Storage schema** (`chrome.storage.sync`)
```json
{
  "passwordHash": "<sha-256 hex string>",
  "protectedUrls": ["https://example.com/page"]
}
```

**URL matching** — exact match after normalization (trailing slash stripped, query string and hash preserved)

**SPA support** — `history.pushState` and `history.replaceState` are patched at injection time; `popstate` is also listened to

**Permissions** — `storage`, `tabs`, `activeTab`, `host_permissions: <all_urls>`

---

## Tech Stack

- Manifest V3
- Vanilla JavaScript (no framework, no build step)
- Web Crypto API (`crypto.subtle`) for SHA-256
- `chrome.storage.sync` for cross-device persistence

---

## License

MIT
