/**
 * Super Bookmarks - Content Script
 * Runs in the context of web pages
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__superBookmarksInjected) return;
  window.__superBookmarksInjected = true;

  /**
   * Get selected text with context
   */
  function getSelectionInfo() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return null;
    }

    const text = selection.toString().trim();
    if (!text) {
      return null;
    }

    return {
      text: text,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now()
    };
  }

  /**
   * Get page metadata
   */
  function getPageInfo() {
    // Try to get Open Graph or meta description
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const metaDescription = document.querySelector('meta[name="description"]');
    const description = ogDescription?.content || metaDescription?.content || '';

    // Get main content (simplified extraction)
    const article = document.querySelector('article');
    const main = document.querySelector('main');
    const content = article?.textContent || main?.textContent || '';

    return {
      url: window.location.href,
      title: document.title,
      description: description.slice(0, 500),
      excerpt: content.slice(0, 1000).trim(),
      timestamp: Date.now()
    };
  }

  /**
   * Listen for messages from the extension
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_SELECTION':
        sendResponse(getSelectionInfo());
        break;

      case 'GET_PAGE_INFO':
        sendResponse(getPageInfo());
        break;

      case 'PING':
        sendResponse({ pong: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }

    return true;
  });

  console.log('[SuperBookmarks] Content script loaded');
})();
