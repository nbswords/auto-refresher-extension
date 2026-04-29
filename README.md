# Auto Refresh

A lightweight Chrome extension (Manifest V3) that auto-refreshes the current tab on a user-defined interval. Each tab has its own timer, so you can refresh several tabs at different rates simultaneously.

<img width="1280" height="800" alt="auto-refresher-2-1280" src="https://github.com/user-attachments/assets/0ad20d3e-acaf-46fc-a5e0-92230900d6e9" />
<img width="1280" height="800" alt="auto-refresher-1-1280" src="https://github.com/user-attachments/assets/ebd0d8ac-1a53-45a7-987f-3ac11952e623" />


## Features

- **Custom interval** — Any value from `0.1s` up to `86400s` (24h), including fractions like `0.5`
- **Quick presets** — One-click buttons for `1s / 5s / 10s / 60s`
- **Per-tab timers** — Different intervals on different tabs at the same time
- **Live countdown** — The popup shows seconds until the next refresh
- **Survives popup close** — Timers run in the background service worker
- **Auto-cleanup** — Timers are removed when a tab is closed
- **Light & Dark theme** — Toggle in the popup, preference is saved
- **Privacy first** — No data collection, no network calls, all state stays local

## Installation

### Manual install (load unpacked)
1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder
5. Pin the toolbar icon for easy access

## Usage

1. Open the tab you want to refresh
2. Click the **Auto Refresh** icon in the toolbar
3. Type a number of seconds, or click a preset (`1s / 5s / 10s / 60s`)
4. Click **Start Refresh**
5. The popup will show a countdown to the next reload
6. Click **Stop Refresh** to cancel

The timer keeps running even if you close the popup or switch to another tab. Closing the tab itself stops the timer automatically.

## How it works

- `manifest.json` — MV3 config; permissions are `alarms`, `storage`, and `tabs`
- `background.js` — Service worker that drives reloads with `setTimeout` (so sub-second intervals work) and uses a 30-second `chrome.alarms` keepalive to rehydrate timers if the worker is suspended
- `popup.html` / `popup.js` — UI with seconds input, presets, theme toggle, and a live countdown
- `icons/` — Toolbar icon assets and a small Pillow script (`generate_icons.py`) that regenerates them

Per-tab state is keyed by `tabId` in `chrome.storage.local` (`{seconds, nextFireAt}`), so closing the popup or restarting the service worker doesn't lose state.

## Permissions

| Permission | Reason |
|------------|--------|
| `alarms`   | Periodic keepalive that lets the service worker re-arm timers after suspension |
| `storage`  | Persists per-tab interval and next-fire timestamp in `chrome.storage.local` |
| `tabs`     | Calls `chrome.tabs.reload(tabId)` on the tab you started refresh on, and detects when that tab is closed |

The extension does not request `<all_urls>` and does not inject any content scripts. No data leaves your browser.

## Caveats

- **Sub-second intervals** are driven by `setTimeout`. If Chrome suspends the service worker between fires, the next reload may be delayed until the keepalive alarm wakes it (≤ 30s). For most short-interval use cases the worker stays alive on its own.
- **Chrome Web Store packed builds** clamp `chrome.alarms` to a 30-second minimum, but this extension drives the actual reload with `setTimeout`, so sub-30s intervals still work.

## Development

Project layout:

```
auto-refresh-extension/
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── icons/
│   ├── generate_icons.py
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

To regenerate icons after tweaking colors or geometry:

```bash
cd icons
python generate_icons.py
```

Pillow is the only dependency (`pip install pillow`).

## Privacy Policy

[Read the full privacy policy](https://nbswords.github.io/auto-refresher-extension/privacy-policy.html)

## License

MIT
