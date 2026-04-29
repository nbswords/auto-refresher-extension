# CLAUDE.md

## Project Overview
Auto Refresh is a Chrome extension (Manifest V3) that reloads the active tab on a user-defined interval, supporting sub-second precision and independent per-tab timers.

## Architecture
- `manifest.json` — MV3 config. Permissions: `alarms`, `storage`, `tabs`. No `content_scripts` and no `<all_urls>`. The action popup is `popup.html`.
- `background.js` — Service worker. Owns the timer engine. Messages handled: `start`, `stop`, `status`, each keyed by `tabId`. Per-tab state lives in `chrome.storage.local` under `refreshTimers` as `{tabId: {seconds, nextFireAt}}`. In-memory `Map<tabId, timeoutId>` tracks active `setTimeout` handles.
- `popup.html` / `popup.js` — Popup UI: number input (`step="0.1"`, min `0.1`, max `86400`), four presets (1/5/10/60s), Start/Stop button, live countdown, light/dark theme toggle. Communicates with the SW via `chrome.runtime.sendMessage` only — no direct tab access from the popup.
- `icons/generate_icons.py` — Pillow script that produces `icon16.png`, `icon48.png`, `icon128.png` (rounded-square purple gradient + white circular-arrow glyph). Re-run after editing colors or geometry.

## Key Design Decisions
- **`setTimeout`, not `chrome.alarms`, drives reloads.** `chrome.alarms` clamps to a 30-second minimum on packed builds, which would break the sub-second use case. The reload loop is a self-rescheduling `setTimeout` in the service worker.
- **`chrome.alarms` is used only as a keepalive.** A single periodic alarm (`auto-refresh-keepalive`, period 0.5 min = 30 s) wakes the SW if Chrome suspends it. On wake, `rehydrate()` reads `chrome.storage.local`, drops timers for tabs that no longer exist (`chrome.tabs.get` rejects), and re-arms `setTimeout`s for the rest using `nextFireAt - Date.now()` as the delay. This keeps timers correct across SW suspension.
- **Per-tab state, not global.** Different tabs can run different intervals simultaneously. Tab IDs are the storage key. `chrome.tabs.onRemoved` clears the entry and the in-memory timeout when a tab closes.
- **Popup is stateless w.r.t. timers.** All authoritative state is in storage / SW; the popup just queries `status` for the active tab and renders. This means the popup can close/reopen without disturbing running timers.
- **Theme preference is popup-local** — stored in the popup's own `localStorage`, not `chrome.storage`, because it's a UI preference that doesn't need to reach the SW.
- **No content scripts, no host permissions.** Reloads are issued from the SW via `chrome.tabs.reload(tabId)`, which is why `tabs` (rather than `activeTab`) is required — the reload is not a direct user gesture on the tab.

## Message Protocol (popup ↔ SW)
- `{type: "start", tabId, seconds}` → starts/replaces the timer for `tabId`. Replies `{ok: true}`.
- `{type: "stop", tabId}` → clears storage + in-memory timeout for `tabId`. Replies `{ok: true}`.
- `{type: "status", tabId}` → replies with `{seconds, nextFireAt}` or `null`.

The `onMessage` handler returns `true` to keep `sendResponse` alive across the async work.

## Local Development
- No build step. Raw JS/HTML/CSS.
- Load unpacked from `chrome://extensions/` (Developer mode on) → "Load unpacked" → select repo root.
- After editing files, click the extension's reload arrow on `chrome://extensions/`. Open DevTools for the SW from the same page if you need to inspect logs.
- Regenerate icons: `pip install pillow` once, then `cd icons && python generate_icons.py`.

## Things to be careful about when editing
- Don't replace `setTimeout` with `chrome.alarms.create({periodInMinutes: ...})` — sub-second intervals will silently break on packed builds.
- Keep `rehydrate()` idempotent. It runs on `onStartup`, `onInstalled`, and on every keepalive fire; double-arming a timer would cause double reloads.
- The keepalive alarm's `periodInMinutes` is `0.5` (30 s). Lowering it has no effect on packed builds (clamped). Raising it widens the worst-case suspension window before timers re-arm.
- `seconds` flows as `number` (possibly fractional) end-to-end — don't `parseInt` it in the popup or background.
