/**
 * Vector Search
 * Semantic search using cosine similarity
 */

export class VectorSearch {
  constructor(database) {
    this.db = database;
    this.embeddingCache = null;
    this.cacheValid = false;
  }

  /**
   * Compute cosine similarity between two vectors
   * Uses typed arrays for efficiency
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Perform semantic search
   */
  async search(queryEmbedding, options = {}) {
    const {
      limit = 20,
      threshold = 0.3,
      tagFilter = null,
      excludeIds = []
    } = options;

    // Load and cache embeddings if needed
    if (!this.cacheValid || !this.embeddingCache) {
      await this.refreshCache();
    }

    // Compute similarities
    const results = [];

    for (const [noteId, embedding] of this.embeddingCache) {
      // Skip excluded IDs
      if (excludeIds.includes(noteId)) continue;

      const score = this.cosineSimilarity(queryEmbedding, embedding.vector);

      if (score >= threshold) {
        results.push({ noteId, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const topResults = results.slice(0, limit);

    // Fetch full note data
    const notesWithScores = await Promise.all(
      topResults.map(async (r) => {
        const note = await this.db.getNote(r.noteId);
        if (!note) return null;

        // Apply tag filter if specified
        if (tagFilter && tagFilter.length > 0) {
          const hasMatchingTag = tagFilter.some(t =>
            note.tags.map(nt => nt.toLowerCase()).includes(t.toLowerCase())
          );
          if (!hasMatchingTag) return null;
        }

        return {
          ...note,
          score: r.score
        };
      })
    );

    return notesWithScores.filter(n => n !== null);
  }

  /**
   * Find similar notes to a given note
   */
  async findSimilar(noteId, limit = 5) {
    const embedding = await this.db.getEmbedding(noteId);
    if (!embedding) {
      return [];
    }

    return this.search(embedding.vector, {
      limit: limit + 1, // +1 because we'll exclude the original
      threshold: 0.5,
      excludeIds: [noteId]
    });
  }

  /**
   * Refresh the embedding cache
   */
  async refreshCache() {
    this.embeddingCache = await this.db.getAllEmbeddings();
    this.cacheValid = true;
  }

  /**
   * Invalidate the cache
   */
  invalidateCache() {
    this.cacheValid = false;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      isValid: this.cacheValid,
      size: this.embeddingCache ? this.embeddingCache.size : 0,
      memoryEstimate: this.embeddingCache
        ? this.embeddingCache.size * 384 * 4 // 384 floats * 4 bytes
        : 0
    };
  }

  /**
   * Warm up the cache
   */
  async warmUp() {
    if (!this.cacheValid) {
      await this.refreshCache();
    }
  }

  /**
   * Perform a hybrid search (semantic + keyword)
   */
  async hybridSearch(queryEmbedding, keywords, options = {}) {
    const {
      limit = 20,
      semanticWeight = 0.7,
      keywordWeight = 0.3,
      threshold = 0.3
    } = options;

    // Get semantic results
    const semanticResults = await this.search(queryEmbedding, {
      limit: limit * 2, // Get more for merging
      threshold
    });

    // Get keyword results
    const keywordResults = await this.keywordSearch(keywords, limit * 2);

    // Merge and score
    const scoreMap = new Map();

    // Add semantic scores
    semanticResults.forEach((note, index) => {
      const semanticScore = note.score * semanticWeight;
      const positionBoost = 1 - (index / semanticResults.length) * 0.1;
      scoreMap.set(note.id, {
        note,
        score: semanticScore * positionBoost
      });
    });

    // Add keyword scores
    keywordResults.forEach((note, index) => {
      const keywordScore = (1 - index / keywordResults.length) * keywordWeight;
      const existing = scoreMap.get(note.id);

      if (existing) {
        existing.score += keywordScore;
      } else {
        scoreMap.set(note.id, {
          note,
          score: keywordScore
        });
      }
    });

    // Sort by combined score
    const merged = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.note,
        score: item.score
      }));

    return merged;
  }

  /**
   * Simple keyword search (fallback when model isn't loaded)
   */
  async keywordSearch(keywords, limit = 20) {
    if (!keywords || keywords.length === 0) {
      return [];
    }

    const allNotes = await this.db.getAllNotes({ limit: 1000 });
    const keywordLower = keywords.map(k => k.toLowerCase());

    // Score notes by keyword matches
    const scored = allNotes.map(note => {
      let score = 0;
      const searchText = (note.title + ' ' + note.content + ' ' + note.tags.join(' ')).toLowerCase();

      for (const keyword of keywordLower) {
        // Count occurrences
        const matches = (searchText.match(new RegExp(keyword, 'gi')) || []).length;
        score += matches;

        // Boost for title matches
        if (note.title.toLowerCase().includes(keyword)) {
          score += 2;
        }

        // Boost for tag matches
        if (note.tags.some(t => t.toLowerCase().includes(keyword))) {
          score += 1.5;
        }
      }

      return { note, score };
    });

    // Filter and sort
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.note,
        score: item.score / keywordLower.length // Normalize score
      }));
  }

  /**
   * Tag-only search (for tag: modifier)
   */
  async tagSearch(tagTerms, limit = 20) {
    if (!tagTerms || tagTerms.length === 0) {
      return [];
    }

    const allNotes = await this.db.getAllNotes({ limit: 1000 });
    const termLower = tagTerms.map(t => t.toLowerCase());

    // Score notes by tag matches only
    const scored = allNotes.map(note => {
      let score = 0;

      for (const term of termLower) {
        for (const tag of note.tags) {
          if (tag.toLowerCase().includes(term)) {
            // Exact match gets bonus
            score += tag.toLowerCase() === term ? 2 : 1;
          }
        }
      }

      return { note, score };
    });

    // Filter and sort
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.note,
        score: item.score
      }));
  }
}
