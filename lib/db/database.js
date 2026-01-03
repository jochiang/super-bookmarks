/**
 * IndexedDB Database wrapper for Super Bookmarks
 */

import { DB_NAME, DB_VERSION, STORES, createNote, createTag } from './schema.js';

export class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Open the database connection
   */
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        for (const [storeName, config] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: config.keyPath,
              autoIncrement: config.autoIncrement
            });

            for (const index of config.indexes) {
              store.createIndex(index.name, index.keyPath, index.options);
            }
          }
        }
      };
    });
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ==================== Note Operations ====================

  /**
   * Save a note (create or update)
   */
  async saveNote(noteData) {
    const note = createNote(noteData);
    const tx = this.db.transaction(['notes', 'tags'], 'readwrite');
    const notesStore = tx.objectStore('notes');
    const tagsStore = tx.objectStore('tags');

    // Save the note
    await this.promisifyRequest(notesStore.put(note));

    // Update tag usage counts
    for (const tagName of note.tags) {
      const normalizedTag = tagName.toLowerCase().trim();
      const existingTag = await this.promisifyRequest(tagsStore.get(normalizedTag));

      if (existingTag) {
        existingTag.usageCount++;
        await this.promisifyRequest(tagsStore.put(existingTag));
      } else {
        await this.promisifyRequest(tagsStore.put(createTag(tagName)));
      }
    }

    return note;
  }

  /**
   * Get a note by ID
   */
  async getNote(id) {
    const tx = this.db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    return this.promisifyRequest(store.get(id));
  }

  /**
   * Get a note by URL (returns first match, or null)
   */
  async getNoteByUrl(url) {
    if (!url) return null;

    const tx = this.db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    const index = store.index('byUrl');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(url));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        resolve(cursor ? cursor.value : null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an existing note
   */
  async updateNote(id, updates) {
    const existing = await this.getNote(id);
    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: Date.now()
    };

    // Recalculate metadata if content changed
    if (updates.content !== undefined) {
      updated.excerpt = updates.content.slice(0, 200);
      updated.metadata = {
        ...updated.metadata,
        wordCount: updates.content.split(/\s+/).filter(w => w).length,
        charCount: updates.content.length
      };
    }

    const tx = this.db.transaction('notes', 'readwrite');
    await this.promisifyRequest(tx.objectStore('notes').put(updated));

    return updated;
  }

  /**
   * Delete a note and its embedding
   */
  async deleteNote(id) {
    const tx = this.db.transaction(['notes', 'embeddings'], 'readwrite');
    await this.promisifyRequest(tx.objectStore('notes').delete(id));
    await this.promisifyRequest(tx.objectStore('embeddings').delete(id));
  }

  /**
   * Get all notes with pagination
   */
  async getAllNotes(options = {}) {
    const { limit = 50, offset = 0, orderBy = 'updatedAt', order = 'desc' } = options;

    const tx = this.db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');

    // Try to use index if available
    let source = store;
    const indexName = `by${orderBy.charAt(0).toUpperCase()}${orderBy.slice(1)}`;
    if (store.indexNames.contains(indexName)) {
      source = store.index(indexName);
    }

    return new Promise((resolve, reject) => {
      const results = [];
      let skipped = 0;
      const direction = order === 'desc' ? 'prev' : 'next';

      const request = source.openCursor(null, direction);

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }

        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        results.push(cursor.value);
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Search notes by tags
   */
  async searchByTags(tags) {
    const tx = this.db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    const index = store.index('byTags');

    const resultMap = new Map();

    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim();

      await new Promise((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.only(normalizedTag));

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) {
            resolve();
            return;
          }
          resultMap.set(cursor.value.id, cursor.value);
          cursor.continue();
        };

        request.onerror = () => reject(request.error);
      });
    }

    return Array.from(resultMap.values());
  }

  /**
   * Get notes count
   */
  async getNotesCount() {
    const tx = this.db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    return this.promisifyRequest(store.count());
  }

  // ==================== Embedding Operations ====================

  /**
   * Save an embedding for a note
   */
  async saveEmbedding(noteId, vector, modelVersion = 'all-MiniLM-L6-v2') {
    const tx = this.db.transaction('embeddings', 'readwrite');
    const store = tx.objectStore('embeddings');

    await this.promisifyRequest(store.put({
      noteId,
      vector,
      modelVersion,
      computedAt: Date.now()
    }));
  }

  /**
   * Get embedding for a note
   */
  async getEmbedding(noteId) {
    const tx = this.db.transaction('embeddings', 'readonly');
    const store = tx.objectStore('embeddings');
    return this.promisifyRequest(store.get(noteId));
  }

  /**
   * Get all embeddings as a Map
   */
  async getAllEmbeddings() {
    const tx = this.db.transaction('embeddings', 'readonly');
    const store = tx.objectStore('embeddings');

    return new Promise((resolve, reject) => {
      const cache = new Map();
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(cache);
          return;
        }
        cache.set(cursor.value.noteId, cursor.value);
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete embedding for a note
   */
  async deleteEmbedding(noteId) {
    const tx = this.db.transaction('embeddings', 'readwrite');
    await this.promisifyRequest(tx.objectStore('embeddings').delete(noteId));
  }

  // ==================== Tag Operations ====================

  /**
   * Get all tags sorted by usage
   */
  async getAllTags() {
    const tx = this.db.transaction('tags', 'readonly');
    const store = tx.objectStore('tags');
    const index = store.index('byUsageCount');

    return new Promise((resolve, reject) => {
      const results = [];
      const request = index.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Search tags by prefix
   */
  async searchTags(prefix) {
    const tags = await this.getAllTags();
    const lowerPrefix = prefix.toLowerCase();
    return tags.filter(tag => tag.name.startsWith(lowerPrefix));
  }

  // ==================== Meta Operations ====================

  /**
   * Get a meta value
   */
  async getMeta(key) {
    const tx = this.db.transaction('meta', 'readonly');
    const store = tx.objectStore('meta');
    const result = await this.promisifyRequest(store.get(key));
    return result ? result.value : null;
  }

  /**
   * Set a meta value
   */
  async setMeta(key, value) {
    const tx = this.db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    await this.promisifyRequest(store.put({ key, value }));
  }

  // ==================== Export/Import Operations ====================

  /**
   * Export entire database for backup
   */
  async exportAll() {
    const data = {
      version: DB_VERSION,
      exportedAt: Date.now(),
      notes: [],
      embeddings: [],
      tags: []
    };

    // Get all data from each store
    for (const storeName of ['notes', 'embeddings', 'tags']) {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      data[storeName] = await this.promisifyRequest(store.getAll());
    }

    // Convert Float32Arrays to regular arrays for JSON serialization
    data.embeddings = data.embeddings.map(e => ({
      ...e,
      vector: Array.from(e.vector)
    }));

    return data;
  }

  /**
   * Import database from backup
   */
  async importAll(data, options = { clearExisting: true }) {
    if (options.clearExisting) {
      // Clear existing data
      for (const storeName of ['notes', 'embeddings', 'tags']) {
        const tx = this.db.transaction(storeName, 'readwrite');
        await this.promisifyRequest(tx.objectStore(storeName).clear());
      }
    }

    // Import notes
    const notesTx = this.db.transaction('notes', 'readwrite');
    const notesStore = notesTx.objectStore('notes');
    for (const note of data.notes) {
      await this.promisifyRequest(notesStore.put(note));
    }

    // Import embeddings (convert arrays back to Float32Array)
    const embeddingsTx = this.db.transaction('embeddings', 'readwrite');
    const embeddingsStore = embeddingsTx.objectStore('embeddings');
    for (const embedding of data.embeddings) {
      await this.promisifyRequest(embeddingsStore.put({
        ...embedding,
        vector: new Float32Array(embedding.vector)
      }));
    }

    // Import tags
    const tagsTx = this.db.transaction('tags', 'readwrite');
    const tagsStore = tagsTx.objectStore('tags');
    for (const tag of data.tags) {
      await this.promisifyRequest(tagsStore.put(tag));
    }

    return {
      notesImported: data.notes.length,
      embeddingsImported: data.embeddings.length,
      tagsImported: data.tags.length
    };
  }

  // ==================== Utility ====================

  /**
   * Convert IDBRequest to Promise
   */
  promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let dbInstance = null;

export async function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
    await dbInstance.open();
  }
  return dbInstance;
}
