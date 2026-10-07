// HMR-START
import handleReload from "./handleReload.js";
handleReload();
// HMR-END

import {
  analyzeContent,
  ApiError,
  normalizeResult,
} from "../shared/api.js";
import { getToken } from "../shared/storage.js";

const MENU_LINK = "safedm-check-link";
const MENU_SELECTION = "safedm-check-selection";

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_LINK,
      title: "Vérifier avec SafeDM",
      contexts: ["link"],
    });
    chrome.contextMenus.create({
      id: MENU_SELECTION,
      title: "Vérifier avec SafeDM",
      contexts: ["selection"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createMenus();
});

chrome.runtime.onStartup?.addListener?.(() => {
  createMenus();
});

createMenus();

async function ensureAuth() {
  const token = await getToken();
  if (!token) {
    throw new ApiError(
      "Connectez-vous via le popup SafeDM pour analyser.",
      401,
      null,
    );
  }
}

async function runAnalysis(text) {
  await ensureAuth();
  return analyzeContent(text);
}

async function pushBannerToTab(tabId, payload) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "safedmShowResult",
      payload,
    });
  } catch {
    // Page may block content scripts (chrome://, Web Store, etc.)
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const tabId = tab?.id;
  let text = "";

  if (info.menuItemId === MENU_LINK) {
    text = info.linkUrl || "";
  } else if (info.menuItemId === MENU_SELECTION) {
    text = info.selectionText || "";
  } else {
    return;
  }

  if (!text.trim()) {
    await pushBannerToTab(tabId, {
      decision: "WARN",
      headline: "Rien à analyser",
      summary: "Aucun lien ou texte sélectionné.",
      can_open: true,
    });
    return;
  }

  await pushBannerToTab(tabId, {
    decision: "PENDING",
    headline: "Analyse SafeDM en cours…",
    summary: text.slice(0, 120),
    can_open: true,
  });

  try {
    const result = await runAnalysis(text);
    await pushBannerToTab(tabId, result);
  } catch (err) {
    await pushBannerToTab(tabId, {
      decision: "WARN",
      headline: err?.message || "Échec de l’analyse",
      summary: err?.status === 401 ? "Ouvrez le popup pour vous connecter." : null,
      can_open: true,
      error: true,
    });
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action === "getTabInfo") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      if (t) {
        sendResponse({ url: t.url, title: t.title, id: t.id });
      } else {
        sendResponse(null);
      }
    });
    return true;
  }

  if (request?.action === "analyze") {
    (async () => {
      try {
        const text = request.text || "";
        const result = await runAnalysis(text);
        sendResponse({ ok: true, result });

        if (request.showOnPage && request.tabId) {
          await pushBannerToTab(request.tabId, result);
        }
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || "Erreur d’analyse",
          status: err?.status,
        });
      }
    })();
    return true;
  }

  if (request?.action === "showResultOnPage") {
    (async () => {
      const tabId = request.tabId;
      const payload = normalizeResult(request.result, request.text || "");
      await pushBannerToTab(tabId, payload);
      sendResponse({ ok: true });
    })();
    return true;
  }

  return false;
});
