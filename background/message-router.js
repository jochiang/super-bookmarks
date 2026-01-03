/**
 * Message Router for cross-component communication
 */

export class MessageRouter {
  constructor() {
    this.handlers = new Map();
    this.setupDefaultHandlers();
  }

  /**
   * Register a message handler
   */
  on(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * Handle incoming messages
   */
  async handle(message, sender, sendResponse) {
    const { type, payload } = message;

    console.log(`[MessageRouter] Received: ${type}`, payload);

    const handler = this.handlers.get(type);
    if (handler) {
      try {
        const result = await handler(payload, sender);
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error(`[MessageRouter] Error handling ${type}:`, error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      // Forward to all extension pages if no handler
      this.broadcast(message);
      sendResponse({ success: true, forwarded: true });
    }

    return true; // Keep channel open for async responses
  }

  /**
   * Broadcast message to all extension contexts
   */
  broadcast(message) {
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors from no receivers
    });
  }

  /**
   * Set up default message handlers
   */
  setupDefaultHandlers() {
    // Ping handler for connection testing
    this.on('PING', () => ({ pong: true, timestamp: Date.now() }));

    // Get current tab info
    this.on('GET_CURRENT_TAB', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab ? {
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl
      } : null;
    });

    // Open side panel from content script
    this.on('OPEN_PANEL', async (payload, sender) => {
      if (sender.tab) {
        await chrome.sidePanel.open({ tabId: sender.tab.id });
      }
    });
  }
}
