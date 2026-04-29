const secondsInput = document.getElementById("seconds");
const toggleBtn = document.getElementById("toggleBtn");
const statusBar = document.getElementById("statusBar");
const statusText = document.getElementById("status");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const presetButtons = document.querySelectorAll(".preset-btn");

let currentTabId = null;
let countdownTimer = null;

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function setRunning(running, nextFireAt, seconds) {
  clearInterval(countdownTimer);
  if (running) {
    toggleBtn.textContent = "⏸ Stop Refresh";
    toggleBtn.classList.add("running");
    statusBar.classList.add("active");
    secondsInput.disabled = true;
    presetButtons.forEach((b) => (b.disabled = true));
    updateCountdown(nextFireAt, seconds);
    countdownTimer = setInterval(() => updateCountdown(nextFireAt, seconds), 250);
  } else {
    toggleBtn.textContent = "▶ Start Refresh";
    toggleBtn.classList.remove("running");
    statusBar.classList.remove("active");
    statusText.textContent = "Stopped";
    secondsInput.disabled = false;
    presetButtons.forEach((b) => (b.disabled = false));
  }
}

function formatSec(s) {
  return Number.isInteger(s) ? `${s}` : s.toFixed(1);
}

function updateCountdown(nextFireAt, seconds) {
  const remainingMs = Math.max(0, nextFireAt - Date.now());
  if (remainingMs <= 0) {
    statusText.textContent = `Refreshing... (every ${formatSec(seconds)}s)`;
  } else if (seconds < 1) {
    statusText.textContent = `Next refresh in ${(remainingMs / 1000).toFixed(1)}s`;
  } else {
    statusText.textContent = `Next refresh in ${Math.ceil(remainingMs / 1000)}s`;
  }
}

function syncPresetActive(seconds) {
  presetButtons.forEach((btn) => {
    btn.classList.toggle("active", parseFloat(btn.dataset.sec) === seconds);
  });
}

async function refreshUI() {
  if (currentTabId == null) return;
  const status = await send({ type: "status", tabId: currentTabId });
  if (status) {
    secondsInput.value = formatSec(status.seconds);
    syncPresetActive(status.seconds);
    setRunning(true, status.nextFireAt, status.seconds);
  } else {
    setRunning(false);
    syncPresetActive(parseFloat(secondsInput.value));
  }
}

toggleBtn.addEventListener("click", async () => {
  if (currentTabId == null) return;
  const isRunning = toggleBtn.classList.contains("running");
  if (isRunning) {
    await send({ type: "stop", tabId: currentTabId });
  } else {
    const raw = parseFloat(secondsInput.value);
    const seconds = Number.isFinite(raw) && raw >= 0.1 ? raw : 1;
    secondsInput.value = formatSec(seconds);
    await send({ type: "start", tabId: currentTabId, seconds });
  }
  await refreshUI();
});

presetButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const sec = parseFloat(btn.dataset.sec);
    secondsInput.value = formatSec(sec);
    syncPresetActive(sec);
  });
});

secondsInput.addEventListener("input", () => {
  syncPresetActive(parseFloat(secondsInput.value));
});

// Theme persistence
const savedTheme = localStorage.getItem("auto-refresh-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
themeIcon.innerHTML = savedTheme === "dark" ? "&#9790;" : "&#9728;";

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  themeIcon.innerHTML = next === "dark" ? "&#9790;" : "&#9728;";
  localStorage.setItem("auto-refresh-theme", next);
});

(async () => {
  currentTabId = await getActiveTabId();
  await refreshUI();
})();

window.addEventListener("unload", () => clearInterval(countdownTimer));
