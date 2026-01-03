/**
 * Context Menu setup and handlers
 */

const MENU_IDS = {
  ADD_SELECTION: 'super-bookmark-selection',
  ADD_PAGE: 'super-bookmark-page'
};

/**
 * Create context menu items
 */
export function setupContextMenus() {
  // Remove existing menus first to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Add selection to Super Bookmarks
    chrome.contextMenus.create({
      id: MENU_IDS.ADD_SELECTION,
      title: 'Add to Super Bookmarks',
      contexts: ['selection']
    });

    // Bookmark entire page
    chrome.contextMenus.create({
      id: MENU_IDS.ADD_PAGE,
      title: 'Bookmark this page',
      contexts: ['page']
    });
  });
}

/**
 * Handle context menu clicks
 */
export function handleContextMenuClick(info, tab) {
  switch (info.menuItemId) {
    case MENU_IDS.ADD_SELECTION:
      handleAddSelection(info, tab);
      break;
    case MENU_IDS.ADD_PAGE:
      handleAddPage(info, tab);
      break;
  }
}

/**
 * Handle adding selected text
 */
async function handleAddSelection(info, tab) {
  const payload = {
    text: info.selectionText,
    url: info.pageUrl,
    title: tab.title,
    favicon: tab.favIconUrl || null
  };

  // Store pending data FIRST (synchronously start the promise)
  const storagePromise = chrome.storage.local.set({
    pendingAction: { type: 'ADD_SELECTION', payload, timestamp: Date.now() }
  });

  // Open side panel IMMEDIATELY (must be in direct response to user gesture)
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Error opening side panel:', error);
    return;
  }

  // Now wait for storage and send message
  await storagePromise;
  await new Promise(resolve => setTimeout(resolve, 200));

  chrome.runtime.sendMessage({
    type: 'ADD_SELECTION',
    payload
  }).catch(() => {
    // Panel will pick up from storage instead
  });
}

/**
 * Handle bookmarking entire page
 */
async function handleAddPage(info, tab) {
  const payload = {
    url: info.pageUrl,
    title: tab.title,
    favicon: tab.favIconUrl || null
  };

  // Store pending data FIRST (synchronously start the promise)
  const storagePromise = chrome.storage.local.set({
    pendingAction: { type: 'ADD_PAGE', payload, timestamp: Date.now() }
  });

  // Open side panel IMMEDIATELY (must be in direct response to user gesture)
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Error opening side panel:', error);
    return;
  }

  // Now wait for storage and send message
  await storagePromise;
  await new Promise(resolve => setTimeout(resolve, 200));

  chrome.runtime.sendMessage({
    type: 'ADD_PAGE',
    payload
  }).catch(() => {
    // Panel will pick up from storage instead
  });
}

export { MENU_IDS };
