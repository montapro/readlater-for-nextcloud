import "./utils/patchFetchCredentials";
import browser from "webextension-polyfill";
import { ReadLaterClient, Link } from "@readlater/core";
import { readStoredConfig, toWebDavConfig } from "./utils/storedConfig";
import { runLoginFlow } from "./loginFlowWorker";

/**
 * Updates the extension badge: shows unread count (blue) or green checkmark
 * when the current tab is already saved and unread.
 */
async function updateTabBadge(tabId: number, url?: string) {
  if (!url) {
    browser.action.setBadgeText({ text: "", tabId });
    return;
  }

  const data = await browser.storage.local.get(["links_cache"]);
  const links = (data.links_cache as Link[]) || [];

  const unreadCount = links.filter(l => !l.isRead).length;
  if (unreadCount === 0) {
    browser.action.setBadgeText({ text: "", tabId });
    return;
  }

  const isCurrentSavedAndUnread = links.some(l => l.url === url && !l.isRead);

  if (isCurrentSavedAndUnread) {
    browser.action.setBadgeBackgroundColor({ color: "#10b981", tabId });
    browser.action.setBadgeText({ text: `${Math.min(unreadCount, 99)}`, tabId });
  } else {
    browser.action.setBadgeBackgroundColor({ color: "#2563eb", tabId });
    browser.action.setBadgeText({ text: String(Math.min(unreadCount, 99)), tabId });
  }
}

/**
 * Syncs links from WebDAV and updates the cache.
 */
async function syncLinks() {
  const stored = await readStoredConfig();
  if (stored) {
    try {
      const client = new ReadLaterClient(toWebDavConfig(stored));
      const store = await client.fetchLinks();
      
      await browser.storage.local.set({ links_cache: store.links });
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab?.id) {
        updateTabBadge(activeTab.id, activeTab.url);
      }
    } catch (err) {
      console.error("ReadLater: Background sync failed", err);
    }
  }
}

// Listen for tab changes
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    updateTabBadge(tabId, tab.url);
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  updateTabBadge(activeInfo.tabId, tab.url);
});

// React to storage changes – re-sync when config changes
browser.storage.onChanged.addListener((changes) => {
  if (
    changes.nc_server ||
    changes.nc_username ||
    changes.nc_apppw ||
    changes.nc_uid ||
    changes.nc_basepath ||
    changes.webdav_url ||
    changes.webdav_user ||
    changes.webdav_pass
  ) {
    syncLinks();
  }
  if (changes.links_cache) {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        updateTabBadge(activeTab.id, activeTab.url);
      }
    });
  }
});

browser.runtime.onInstalled.addListener(() => syncLinks());
browser.runtime.onStartup.addListener(() => syncLinks());

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { type?: string; instance?: string };
  if (msg.type === "SYNC_LINKS") {
    syncLinks();
  }
  if (msg.type === "START_LOGIN_FLOW" && msg.instance) {
    runLoginFlow(msg.instance);
  }
});
