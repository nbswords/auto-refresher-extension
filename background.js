const STORAGE_KEY = "refreshTimers";
const KEEPALIVE_ALARM = "auto-refresh-keepalive";

// In-memory timeouts; rebuilt from storage on SW restart.
const timers = new Map();

chrome.runtime.onStartup.addListener(rehydrate);
chrome.runtime.onInstalled.addListener(() => {
  // 0.5 min is the minimum allowed period for packed extensions; this only
  // exists to wake the service worker periodically and re-arm any timers
  // that were lost when the SW was suspended.
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  rehydrate();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) rehydrate();
});

async function getTimers() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function saveTimers(t) {
  await chrome.storage.local.set({ [STORAGE_KEY]: t });
}

function clearLocalTimer(tabId) {
  if (timers.has(tabId)) {
    clearTimeout(timers.get(tabId));
    timers.delete(tabId);
  }
}

function scheduleFire(tabId, seconds, delayMs) {
  clearLocalTimer(tabId);
  const id = setTimeout(async () => {
    timers.delete(tabId);
    try {
      await chrome.tabs.reload(tabId);
      const t = await getTimers();
      if (t[tabId]) {
        t[tabId].nextFireAt = Date.now() + seconds * 1000;
        await saveTimers(t);
        scheduleFire(tabId, seconds, seconds * 1000);
      }
    } catch {
      await stopRefresh(tabId);
    }
  }, Math.max(0, delayMs));
  timers.set(tabId, id);
}

async function startRefresh(tabId, seconds) {
  const t = await getTimers();
  t[tabId] = { seconds, nextFireAt: Date.now() + seconds * 1000 };
  await saveTimers(t);
  scheduleFire(tabId, seconds, seconds * 1000);
}

async function stopRefresh(tabId) {
  clearLocalTimer(tabId);
  const t = await getTimers();
  delete t[tabId];
  await saveTimers(t);
}

async function rehydrate() {
  const t = await getTimers();
  let changed = false;
  for (const tabIdStr of Object.keys(t)) {
    const tabId = parseInt(tabIdStr, 10);
    if (timers.has(tabId)) continue;
    try {
      await chrome.tabs.get(tabId);
    } catch {
      delete t[tabIdStr];
      changed = true;
      continue;
    }
    const info = t[tabIdStr];
    const remaining = info.nextFireAt - Date.now();
    scheduleFire(tabId, info.seconds, remaining);
  }
  if (changed) await saveTimers(t);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  stopRefresh(tabId);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "start") {
      await startRefresh(msg.tabId, msg.seconds);
      sendResponse({ ok: true });
    } else if (msg.type === "stop") {
      await stopRefresh(msg.tabId);
      sendResponse({ ok: true });
    } else if (msg.type === "status") {
      const t = await getTimers();
      sendResponse(t[msg.tabId] || null);
    }
  })();
  return true;
});
