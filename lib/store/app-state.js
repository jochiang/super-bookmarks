/**
 * Application State Definitions
 */

export const AppState = {
  /**
   * Get initial application state
   */
  initial: () => ({
    // Current active view
    currentView: 'ingest',

    // Ingest view state
    ingest: {
      title: '',
      url: null,
      content: '',
      tags: [],
      favicon: null,
      isSaving: false,
      isDirty: false,
      sessionId: null, // For tracking current note being edited
      isEditing: false // Track if editing existing note
    },

    // Search state
    search: {
      query: '',
      results: [],
      isSearching: false,
      hasSearched: false,
      selectedIds: [],
      error: null
    },

    // Browse state
    browse: {
      notes: [],
      isLoading: false,
      currentPage: 0,
      pageSize: 20,
      hasMore: true,
      editingId: null,
      selectedIds: [],
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    },

    // Export state
    export: {
      isExporting: false,
      format: 'markdown', // 'markdown' | 'json' | 'html'
      includeEmbeddings: false
    },

    // Model/Embeddings state
    model: {
      isLoaded: false,
      isLoading: false,
      loadProgress: 0,
      loadProgressText: '',
      error: null
    },

    // UI state
    ui: {
      notification: null,
      isModalOpen: false,
      modalContent: null,
      theme: 'dark'
    }
  }),

  /**
   * View names enum
   */
  views: {
    INGEST: 'ingest',
    SEARCH: 'search',
    BROWSE: 'browse',
    EXPORT: 'export',
    SETTINGS: 'settings'
  },

  /**
   * Notification types
   */
  notificationTypes: {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  }
};

/**
 * Create a notification object
 */
export function createNotification(message, type = 'info', duration = 3000) {
  return {
    id: Date.now(),
    message,
    type,
    duration,
    timestamp: Date.now()
  };
}

/**
 * Reset ingest state to defaults
 */
export function getEmptyIngestState() {
  return {
    title: '',
    url: null,
    content: '',
    tags: [],
    favicon: null,
    isSaving: false,
    isDirty: false,
    sessionId: null,
    isEditing: false
  };
}
