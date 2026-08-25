// ==UserScript==
// @name         Theresmore Accelerator
// @namespace    https://codex.local/theresmore-accelerator
// @version      0.1.0
// @description  Theresmore local speed and click helper with a small in-game panel.
// @author       Codex
// @match        https://www.theresmoregame.com/play/*
// @match        https://theresmoregame.g8hh.com/*
// @match        https://theresmoregame.g8hh.com.cn/*
// @match        https://theresmore.thpatch.net/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "theresmore_accelerator_options";
  const DEFAULT_OPTIONS = {
    speedEnabled: false,
    speed: 5,
    autoClickEnabled: false,
    clickIntervalMs: 900,
    clickMaxPerTick: 4,
    panelCollapsed: false,
  };

  const DANGEROUS_TEXT = [
    "ascend",
    "prestige",
    "rebirth",
    "retire",
    "reset",
    "restart",
    "new era",
    "new age",
    "end game",
    "end this",
    "时代",
    "新纪元",
    "重置",
    "转生",
    "飞升",
    "退休",
    "结束",
    "神殿",
    "雕像",
  ];

  const SAFE_ACTION_HINTS = [
    "gather",
    "hunt",
    "chop",
    "mine",
    "build",
    "research",
    "explore",
    "train",
    "buy",
    "upgrade",
    "collect",
    "生产",
    "采集",
    "狩猎",
    "伐木",
    "挖矿",
    "建造",
    "研究",
    "探索",
    "训练",
    "购买",
    "升级",
    "收集",
  ];

  const state = {
    options: loadOptions(),
    realPerfAnchor: 0,
    virtualPerfAnchor: 0,
    realDateAnchor: 0,
    virtualDateAnchor: 0,
    clickTimer: 0,
    panel: null,
    statusEl: null,
  };

  const native = {
    performanceNow: performance.now.bind(performance),
    dateNow: Date.now.bind(Date),
    requestAnimationFrame: window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : null,
  };

  resetClockAnchors();
  patchClock();
  ready(initPanel);

  function loadOptions() {
    try {
      const saved = getStoredValue(STORAGE_KEY, null);
      return { ...DEFAULT_OPTIONS, ...(saved ? JSON.parse(saved) : {}) };
    } catch (_) {
      return { ...DEFAULT_OPTIONS };
    }
  }

  function saveOptions() {
    setStoredValue(STORAGE_KEY, JSON.stringify(state.options));
  }

  function getStoredValue(key, fallback) {
    if (typeof GM_getValue === "function") {
      const value = GM_getValue(key, fallback);
      if (typeof value !== "object" || value === null || typeof value.then !== "function") {
        return value;
      }
    }
    return window.localStorage.getItem(key) || fallback;
  }

  function setStoredValue(key, value) {
    if (typeof GM_setValue === "function") {
      const result = GM_setValue(key, value);
      if (typeof result !== "object" || result === null || typeof result.then !== "function") {
        return;
      }
    }
    window.localStorage.setItem(key, value);
  }

  function activeSpeed() {
    return state.options.speedEnabled ? Math.max(1, Number(state.options.speed) || 1) : 1;
  }

  function resetClockAnchors() {
    state.realPerfAnchor = native.performanceNow();
    state.virtualPerfAnchor = state.realPerfAnchor;
    state.realDateAnchor = native.dateNow();
    state.virtualDateAnchor = state.realDateAnchor;
  }

  function setSpeed(speed, enabled) {
    const oldPerf = virtualPerformanceNow();
    const oldDate = virtualDateNow();
    state.realPerfAnchor = native.performanceNow();
    state.virtualPerfAnchor = oldPerf;
    state.realDateAnchor = native.dateNow();
    state.virtualDateAnchor = oldDate;
    state.options.speed = Number(speed) || DEFAULT_OPTIONS.speed;
    state.options.speedEnabled = Boolean(enabled);
    saveOptions();
    renderStatus();
  }

  function virtualPerformanceNow() {
    return state.virtualPerfAnchor + (native.performanceNow() - state.realPerfAnchor) * activeSpeed();
  }

  function virtualDateNow() {
    return state.virtualDateAnchor + (native.dateNow() - state.realDateAnchor) * activeSpeed();
  }

  function patchClock() {
    try {
      Object.defineProperty(performance, "now", {
        configurable: true,
        value: () => virtualPerformanceNow(),
      });
    } catch (_) {
      // Some browsers expose performance.now as non-configurable.
    }

    Date.now = () => Math.floor(virtualDateNow());

    if (native.requestAnimationFrame) {
      window.requestAnimationFrame = (callback) =>
        native.requestAnimationFrame(() => callback(virtualPerformanceNow()));
    }
  }

  function initPanel() {
    injectStyles();
    state.panel = document.createElement("div");
    state.panel.id = "tm-accelerator-panel";
    state.panel.innerHTML = renderPanelHtml();
    document.body.appendChild(state.panel);
    bindPanel();
    configureAutoClick();
    renderStatus();
  }

  function renderPanelHtml() {
    const { speed, speedEnabled, autoClickEnabled, clickIntervalMs, clickMaxPerTick, panelCollapsed } =
      state.options;
    return `
      <div class="tmacc-head">
        <button class="tmacc-icon" data-action="toggle-panel" title="展开/收起">⚡</button>
        <span class="tmacc-title">Theresmore 加速</span>
        <span class="tmacc-status" data-role="status"></span>
      </div>
      <div class="tmacc-body" ${panelCollapsed ? "hidden" : ""}>
        <label class="tmacc-row">
          <span>时间倍速</span>
          <input type="checkbox" data-option="speedEnabled" ${speedEnabled ? "checked" : ""}>
        </label>
        <label class="tmacc-row">
          <span>倍率</span>
          <select data-option="speed">
            ${[2, 5, 10, 20, 50].map((item) => `<option value="${item}" ${Number(speed) === item ? "selected" : ""}>x${item}</option>`).join("")}
          </select>
        </label>
        <label class="tmacc-row">
          <span>自动点击</span>
          <input type="checkbox" data-option="autoClickEnabled" ${autoClickEnabled ? "checked" : ""}>
        </label>
        <label class="tmacc-row">
          <span>点击间隔</span>
          <input type="number" min="200" step="100" data-option="clickIntervalMs" value="${Number(clickIntervalMs) || 900}">
        </label>
        <label class="tmacc-row">
          <span>每轮最多</span>
          <input type="number" min="1" max="20" step="1" data-option="clickMaxPerTick" value="${Number(clickMaxPerTick) || 4}">
        </label>
        <div class="tmacc-note">默认跳过重置、飞升、时代结束、神殿/雕像等高风险按钮。</div>
      </div>
    `;
  }

  function bindPanel() {
    state.statusEl = state.panel.querySelector("[data-role='status']");
    state.panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action='toggle-panel']");
      if (!button) return;
      state.options.panelCollapsed = !state.options.panelCollapsed;
      saveOptions();
      const body = state.panel.querySelector(".tmacc-body");
      body.hidden = state.options.panelCollapsed;
    });

    state.panel.addEventListener("change", (event) => {
      const field = event.target.closest("[data-option]");
      if (!field) return;
      const key = field.dataset.option;
      const value = field.type === "checkbox" ? field.checked : Number(field.value);

      if (key === "speed" || key === "speedEnabled") {
        const nextSpeed = key === "speed" ? value : state.options.speed;
        const nextEnabled = key === "speedEnabled" ? value : state.options.speedEnabled;
        setSpeed(nextSpeed, nextEnabled);
      } else {
        state.options[key] = value;
        saveOptions();
      }

      if (key === "autoClickEnabled" || key === "clickIntervalMs") {
        configureAutoClick();
      }
      renderStatus();
    });
  }

  function renderStatus() {
    if (!state.statusEl) return;
    const speedText = state.options.speedEnabled ? `x${state.options.speed}` : "x1";
    const clickText = state.options.autoClickEnabled ? "点" : "停";
    state.statusEl.textContent = `${speedText} / ${clickText}`;
  }

  function configureAutoClick() {
    if (state.clickTimer) {
      window.clearInterval(state.clickTimer);
      state.clickTimer = 0;
    }

    if (!state.options.autoClickEnabled) return;
    const interval = Math.max(200, Number(state.options.clickIntervalMs) || DEFAULT_OPTIONS.clickIntervalMs);
    state.clickTimer = window.setInterval(autoClickVisibleSafeButtons, interval);
  }

  function autoClickVisibleSafeButtons() {
    const maxClicks = Math.max(1, Number(state.options.clickMaxPerTick) || DEFAULT_OPTIONS.clickMaxPerTick);
    const candidates = Array.from(document.querySelectorAll("button, [role='button']"))
      .filter(isVisible)
      .filter(isEnabledButton)
      .filter(isSafeActionButton);

    candidates.slice(0, maxClicks).forEach((button) => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }

  function isEnabledButton(element) {
    return !element.disabled && element.getAttribute("aria-disabled") !== "true";
  }

  function isSafeActionButton(element) {
    const text = normalizeText(element.innerText || element.textContent || element.getAttribute("aria-label") || "");
    if (!text) return false;
    if (DANGEROUS_TEXT.some((item) => text.includes(item))) return false;
    return SAFE_ACTION_HINTS.some((item) => text.includes(item));
  }

  function normalizeText(text) {
    return String(text).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #tm-accelerator-panel {
        position: fixed;
        right: 12px;
        bottom: 92px;
        z-index: 2147483647;
        width: 230px;
        color: #f6f1e8;
        background: rgba(23, 25, 28, 0.94);
        border: 1px solid rgba(246, 241, 232, 0.24);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #tm-accelerator-panel * { box-sizing: border-box; }
      .tmacc-head {
        display: grid;
        grid-template-columns: 28px 1fr auto;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid rgba(246, 241, 232, 0.14);
      }
      .tmacc-icon {
        width: 28px;
        height: 28px;
        border: 1px solid rgba(246, 241, 232, 0.3);
        color: #f6f1e8;
        background: #24272c;
        cursor: pointer;
      }
      .tmacc-title { font-weight: 700; }
      .tmacc-status { color: #f2c66d; font-size: 12px; }
      .tmacc-body {
        display: grid;
        gap: 8px;
        padding: 10px;
      }
      .tmacc-row {
        display: grid;
        grid-template-columns: 1fr 88px;
        align-items: center;
        gap: 8px;
      }
      .tmacc-row input,
      .tmacc-row select {
        width: 88px;
        min-height: 26px;
        color: #f6f1e8;
        background: #101215;
        border: 1px solid rgba(246, 241, 232, 0.24);
      }
      .tmacc-row input[type="checkbox"] {
        width: 18px;
        justify-self: end;
      }
      .tmacc-note {
        color: rgba(246, 241, 232, 0.72);
        font-size: 12px;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ready(callback) {
    if (document.body) {
      callback();
      return;
    }
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  }
})();
