// HMR-START
import handleReload from "./handleReload";
handleReload();
// HMR-END

const BANNER_ID = "safedm-gate-banner";
const STYLE_ID = "safedm-gate-style";

const COLORS = {
  ALLOW: { bg: "#ecfdf3", border: "#027a48", text: "#027a48", accent: "#027a48" },
  WARN: { bg: "#fffaeb", border: "#b54708", text: "#b54708", accent: "#b54708" },
  BLOCK: { bg: "#fef3f2", border: "#b42318", text: "#b42318", accent: "#b42318" },
  PENDING: { bg: "#e8f1fc", border: "#1769d4", text: "#1257b0", accent: "#1769d4" },
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes safedm-slide-in {
      from { transform: translateY(-12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    #${BANNER_ID} {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483646;
      width: min(520px, calc(100vw - 24px));
      font-family: "Segoe UI", system-ui, sans-serif;
      animation: safedm-slide-in 0.25s ease-out;
      box-shadow: 0 8px 28px rgba(20, 24, 31, 0.18);
      border-radius: 10px;
      border: 1px solid;
      overflow: hidden;
    }
    #${BANNER_ID} .safedm-inner {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
      align-items: flex-start;
    }
    #${BANNER_ID} .safedm-mark {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    #${BANNER_ID} .safedm-body { flex: 1; min-width: 0; }
    #${BANNER_ID} .safedm-brand {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.75;
      margin: 0 0 4px;
    }
    #${BANNER_ID} .safedm-title {
      margin: 0;
      font-size: 15px;
      font-weight: 650;
      line-height: 1.3;
    }
    #${BANNER_ID} .safedm-meta {
      margin: 6px 0 0;
      font-size: 12px;
      opacity: 0.9;
      word-break: break-word;
    }
    #${BANNER_ID} .safedm-close {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0 2px;
      opacity: 0.55;
      color: inherit;
    }
    #${BANNER_ID} .safedm-close:hover { opacity: 1; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function decisionLabel(decision) {
  switch (decision) {
    case "ALLOW":
      return "OK";
    case "BLOCK":
      return "!";
    case "PENDING":
      return "…";
    default:
      return "?";
  }
}

function dismissBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

function showResultBanner(payload) {
  ensureStyles();
  dismissBanner();

  const decision = (payload?.decision || "WARN").toUpperCase();
  const palette = COLORS[decision] || COLORS.WARN;
  const score =
    payload?.risk_score != null ? `Score risque : ${payload.risk_score}` : null;
  const summary =
    payload?.summary ||
    payload?.headline_detail ||
    payload?.url ||
    payload?.domain ||
    null;

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.setAttribute("role", "status");
  banner.style.background = palette.bg;
  banner.style.borderColor = palette.border;
  banner.style.color = palette.text;

  banner.innerHTML = `
    <div class="safedm-inner">
      <div class="safedm-mark" style="background:${palette.accent}">${decisionLabel(decision)}</div>
      <div class="safedm-body">
        <p class="safedm-brand">SafeDM</p>
        <p class="safedm-title"></p>
        <p class="safedm-meta"></p>
      </div>
      <button type="button" class="safedm-close" aria-label="Fermer">×</button>
    </div>
  `;

  banner.querySelector(".safedm-title").textContent =
    payload?.headline || decision;
  const metaEl = banner.querySelector(".safedm-meta");
  const metaParts = [score, summary].filter(Boolean);
  if (metaParts.length) {
    metaEl.textContent = metaParts.join(" · ");
  } else {
    metaEl.remove();
  }

  banner.querySelector(".safedm-close").addEventListener("click", dismissBanner);
  (document.body || document.documentElement).appendChild(banner);

  if (decision !== "PENDING") {
    const ttl = decision === "BLOCK" ? 12000 : 8000;
    setTimeout(() => {
      if (document.getElementById(BANNER_ID) === banner) dismissBanner();
    }, ttl);
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action === "safedmShowResult") {
    showResultBanner(request.payload || {});
    sendResponse({ success: true });
    return true;
  }
  return false;
});
