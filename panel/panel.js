/**
 * Super Bookmarks - Panel Controller
 * Main entry point for the side panel UI
 */

import { createStateManager } from '../lib/store/state-manager.js';
import { AppState, createNotification } from '../lib/store/app-state.js';
import { getDatabase } from '../lib/db/database.js';
import { EmbeddingClient } from '../lib/embeddings/embedding-client.js';
import { VectorSearch } from '../lib/embeddings/vector-search.js';

import { IngestView } from './views/ingest-view.js';
import { SearchView } from './views/search-view.js';
import { BrowseView } from './views/browse-view.js';
import { ExportView } from './views/export-view.js';

import { $, $$, show, hide, toggle } from './utils/dom-helpers.js';

class PanelController {
  constructor() {
    this.state = createStateManager(AppState.initial());
    this.db = null;
    this.embeddings = new EmbeddingClient();
    this.vectorSearch = null;

    this.views = {};
    this.currentView = null;
    this.unsubscribers = [];
  }

  /**
   * Initialize the panel
   */
  async init() {
    try {
      // Initialize database
      this.db = await getDatabase();
      this.vectorSearch = new VectorSearch(this.db);

      // Initialize views
      this.views = {
        ingest: new IngestView(this),
        search: new SearchView(this),
        browse: new BrowseView(this),
        export: new ExportView(this)
      };

      // Set up event listeners
      this.setupNavigation();
      this.setupMessageListener();
      this.setupSelectionBar();
      this.setupModal();
      this.setupStateSubscriptions();

      // Show initial view
      this.showView('ingest');

      // Check for pending actions from context menu
      await this.checkPendingActions();

      console.log('[Panel] Initialized successfully');
    } catch (error) {
      console.error('[Panel] Initialization failed:', error);
      this.showNotification('Failed to initialize: ' + error.message, 'error');
    }
  }

  /**
   * Check for pending actions stored by context menu
   */
  async checkPendingActions() {
    try {
      const { pendingAction } = await chrome.storage.local.get('pendingAction');

      if (pendingAction && (Date.now() - pendingAction.timestamp) < 5000) {
        // Clear the pending action
        await chrome.storage.local.remove('pendingAction');

        // Handle the action
        if (pendingAction.type === 'ADD_SELECTION') {
          this.handleAddSelection(pendingAction.payload);
        } else if (pendingAction.type === 'ADD_PAGE') {
          this.handleAddPage(pendingAction.payload);
        }
      }
    } catch (error) {
      console.error('[Panel] Error checking pending actions:', error);
    }
  }

  /**
   * Set up navigation tab clicks
   */
  setupNavigation() {
    $$('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const viewName = e.currentTarget.dataset.view;
        this.showView(viewName);
      });
    });
  }

  /**
   * Set up message listener for communication with background script
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[Panel] Received message:', message.type);

      switch (message.type) {
        case 'ADD_SELECTION':
          this.handleAddSelection(message.payload);
          break;

        case 'ADD_PAGE':
          this.handleAddPage(message.payload);
          break;
      }

      sendResponse({ received: true });
      return true;
    });
  }

  /**
   * Set up selection bar for multi-select
   */
  setupSelectionBar() {
    const selectionBar = $('#selection-bar');
    const clearBtn = $('#selection-clear');
    const exportBtn = $('#selection-export');

    clearBtn.addEventListener('click', () => {
      this.clearSelection();
    });

    exportBtn.addEventListener('click', () => {
      this.exportSelected();
    });

    // Subscribe to selection changes
    this.unsubscribers.push(
      this.state.subscribe('search.selectedIds', () => this.updateSelectionBar()),
      this.state.subscribe('browse.selectedIds', () => this.updateSelectionBar())
    );
  }

  /**
   * Set up modal
   */
  setupModal() {
    const backdrop = $('#modal-backdrop');
    const closeBtn = $('#modal-close');

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.closeModal();
      }
    });

    closeBtn.addEventListener('click', () => {
      this.closeModal();
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.getState().ui.isModalOpen) {
        this.closeModal();
      }
    });
  }

  /**
   * Set up state subscriptions
   */
  setupStateSubscriptions() {
    // Model loading state
    this.unsubscribers.push(
      this.state.subscribe('model.*', () => this.updateLoadingOverlay())
    );

    // Notifications
    this.unsubscribers.push(
      this.state.subscribe('ui.notification', (notification) => {
        if (notification) {
          this.displayNotification(notification);
        }
      })
    );
  }

  /**
   * Switch to a different view
   */
  showView(name) {
    // Update state
    this.state.getState().currentView = name;

    // Update nav tabs
    $$('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === name);
    });

    // Unmount current view
    if (this.currentView) {
      this.currentView.unmount();
    }

    // Mount new view
    const container = $('#view-container');
    container.innerHTML = '';

    this.currentView = this.views[name];
    if (this.currentView) {
      container.appendChild(this.currentView.render());
      this.currentView.mount();
    }
  }

  /**
   * Handle adding selected text from context menu
   */
  handleAddSelection(payload) {
    this.showView('ingest');

    // Wait for view to mount
    requestAnimationFrame(() => {
      this.views.ingest.appendContent(payload.text, payload.url, payload.title, payload.favicon);
    });
  }

  /**
   * Handle bookmarking a page from context menu
   */
  handleAddPage(payload) {
    this.showView('ingest');

    requestAnimationFrame(() => {
      this.views.ingest.setPageInfo(payload.url, payload.title, payload.favicon);
    });
  }

  /**
   * Update selection bar visibility
   */
  updateSelectionBar() {
    const state = this.state.getState();
    const searchSelected = state.search.selectedIds || [];
    const browseSelected = state.browse.selectedIds || [];
    const totalSelected = searchSelected.length + browseSelected.length;

    const bar = $('#selection-bar');
    const countEl = $('#selection-count-num');

    countEl.textContent = totalSelected;
    toggle(bar, totalSelected > 0);
    bar.classList.toggle('visible', totalSelected > 0);
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.state.getState().search.selectedIds = [];
    this.state.getState().browse.selectedIds = [];
  }

  /**
   * Export selected items
   */
  async exportSelected() {
    const state = this.state.getState();
    const allSelectedIds = [
      ...(state.search.selectedIds || []),
      ...(state.browse.selectedIds || [])
    ];

    if (allSelectedIds.length === 0) return;

    // Get selected notes
    const notes = await Promise.all(
      allSelectedIds.map(id => this.db.getNote(id))
    );

    // Switch to export view with pre-selected notes
    this.views.export.setNotesToExport(notes.filter(n => n));
    this.showView('export');
  }

  /**
   * Show loading overlay
   */
  showLoading(text = 'Loading...') {
    const overlay = $('#loading-overlay');
    const textEl = $('#loading-text');

    textEl.textContent = text;
    show(overlay);
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    hide($('#loading-overlay'));
  }

  /**
   * Update loading overlay based on state
   */
  updateLoadingOverlay() {
    const { isLoading, loadProgress, loadProgressText } = this.state.getState().model;

    if (isLoading) {
      this.showLoading(loadProgressText || 'Loading AI model...');
      $('#progress-fill').style.width = `${loadProgress}%`;
    } else {
      this.hideLoading();
    }
  }

  /**
   * Show a notification
   */
  showNotification(message, type = 'info', duration = 3000) {
    const notification = createNotification(message, type, duration);
    this.state.getState().ui.notification = notification;
  }

  /**
   * Display notification in the UI
   */
  displayNotification(notification) {
    const container = $('#notification-container');

    const el = document.createElement('div');
    el.className = `notification ${notification.type}`;
    el.textContent = notification.message;

    container.appendChild(el);

    // Auto-remove
    setTimeout(() => {
      el.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => el.remove(), 300);
    }, notification.duration);

    // Clear from state
    setTimeout(() => {
      if (this.state.getState().ui.notification?.id === notification.id) {
        this.state.getState().ui.notification = null;
      }
    }, notification.duration + 300);
  }

  /**
   * Show modal
   */
  showModal(title, content, footer = null) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = '';

    if (typeof content === 'string') {
      $('#modal-body').innerHTML = content;
    } else {
      $('#modal-body').appendChild(content);
    }

    $('#modal-footer').innerHTML = '';
    if (footer) {
      if (typeof footer === 'string') {
        $('#modal-footer').innerHTML = footer;
      } else {
        $('#modal-footer').appendChild(footer);
      }
    }

    $('#modal-backdrop').classList.add('visible');
    this.state.getState().ui.isModalOpen = true;
  }

  /**
   * Close modal
   */
  closeModal() {
    $('#modal-backdrop').classList.remove('visible');
    this.state.getState().ui.isModalOpen = false;
  }

  /**
   * Clean up subscriptions
   */
  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}

// Initialize panel when DOM is ready
const controller = new PanelController();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => controller.init());
} else {
  controller.init();
}

// Export for debugging
window.__superBookmarks = controller;
