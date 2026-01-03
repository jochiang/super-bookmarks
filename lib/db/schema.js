/**
 * IndexedDB Schema for Super Bookmarks
 */

export const DB_NAME = 'super_bookmarks_db';
export const DB_VERSION = 1;

export const STORES = {
  // Primary notes/bookmarks store
  notes: {
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'byCreatedAt', keyPath: 'createdAt', options: { unique: false } },
      { name: 'byUpdatedAt', keyPath: 'updatedAt', options: { unique: false } },
      { name: 'byUrl', keyPath: 'url', options: { unique: false } },
      { name: 'byTags', keyPath: 'tags', options: { unique: false, multiEntry: true } }
    ]
  },

  // Embeddings stored separately for efficient updates
  embeddings: {
    keyPath: 'noteId',
    autoIncrement: false,
    indexes: []
  },

  // Tags for autocomplete and management
  tags: {
    keyPath: 'name',
    autoIncrement: false,
    indexes: [
      { name: 'byUsageCount', keyPath: 'usageCount', options: { unique: false } }
    ]
  },

  // Application metadata and settings
  meta: {
    keyPath: 'key',
    autoIncrement: false,
    indexes: []
  }
};

/**
 * Generate a UUID v4
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a new note object with defaults
 */
export function createNote(data = {}) {
  const now = Date.now();
  const content = data.content || '';

  return {
    id: data.id || generateId(),
    title: data.title || 'Untitled',
    url: data.url || null,
    content: content,
    excerpt: content.slice(0, 200),
    tags: data.tags || [],
    createdAt: data.createdAt || now,
    updatedAt: now,
    favicon: data.favicon || null,
    metadata: {
      wordCount: content.split(/\s+/).filter(w => w).length,
      charCount: content.length,
      hasHighlights: data.hasHighlights || false
    }
  };
}

/**
 * Create an embedding record
 */
export function createEmbedding(noteId, vector, modelVersion = 'all-MiniLM-L6-v2') {
  return {
    noteId,
    vector,
    modelVersion,
    computedAt: Date.now()
  };
}

/**
 * Create a tag record
 */
export function createTag(name, displayName = null) {
  return {
    name: name.toLowerCase().trim(),
    displayName: displayName || name.trim(),
    usageCount: 1,
    color: null
  };
}

// Meta store keys
export const MetaKeys = {
  MODEL_LOADED: 'model_loaded',
  MODEL_VERSION: 'model_version',
  LAST_BACKUP: 'last_backup',
  SETTINGS: 'settings'
};
