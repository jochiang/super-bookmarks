/**
 * Super Bookmarks - Service Worker
 * Background script for Chrome extension (MV3)
 */

import { setupContextMenus, handleContextMenuClick } from './context-menu.js';
import { MessageRouter } from './message-router.js';

// Initialize message router
const router = new MessageRouter();

// ==================== Event Listeners ====================

/**
 * Extension installed/updated
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[SuperBookmarks] Installed:', details.reason);

  // Set up context menus
  setupContextMenus();

  // Configure side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(error => console.error('Error setting panel behavior:', error));

  // Store install time for first-run experience
  if (details.reason === 'install') {
    chrome.storage.local.set({
      installedAt: Date.now(),
      version: chrome.runtime.getManifest().version
    });
  }
});

/**
 * Extension startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('[SuperBookmarks] Started');
  // Re-setup context menus on browser restart
  setupContextMenus();
});

/**
 * Context menu click handler
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenuClick(info, tab);
});

/**
 * Message handler - route all messages through MessageRouter
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  router.handle(message, sender, sendResponse);
  return true; // Keep channel open for async responses
});

/**
 * Handle action button click (opens side panel by default via setPanelBehavior)
 */
chrome.action.onClicked.addListener(async (tab) => {
  // Panel opens automatically due to setPanelBehavior
  // This handler is for any additional logic
  console.log('[SuperBookmarks] Action clicked for tab:', tab.id);
});

/**
 * Handle tab updates (for potential future features like auto-capture)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Could be used for:
  // - Auto-detecting when user visits a bookmarked page
  // - Updating favicon when page loads
  if (changeInfo.status === 'complete') {
    // Tab finished loading
  }
});

// ==================== Custom Message Handlers ====================

// Add any service-worker-specific message handlers here
router.on('GET_EXTENSION_INFO', () => {
  const manifest = chrome.runtime.getManifest();
  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description
  };
});

console.log('[SuperBookmarks] Service worker initialized');
