/**
 * Embedding Client
 * Promise-based interface for the embedding web worker
 */

export class EmbeddingClient {
  constructor() {
    this.worker = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.progressCallback = null;
  }

  /**
   * Initialize the worker
   */
  initWorker() {
    if (this.worker) return;

    // Create worker as ES module
    const workerUrl = chrome.runtime.getURL('lib/embeddings/embedding-worker.js');
    this.worker = new Worker(workerUrl, { type: 'module' });

    this.worker.onmessage = (event) => {
      const { type, id, payload } = event.data;

      switch (type) {
        case 'WORKER_READY':
          console.log('[EmbeddingClient] Worker ready');
          break;

        case 'PROGRESS':
          if (this.progressCallback) {
            this.progressCallback(payload);
          }
          break;

        case 'BATCH_PROGRESS':
          if (this.progressCallback) {
            this.progressCallback({
              status: 'batch',
              completed: payload.completed,
              total: payload.total,
              message: `Processing ${payload.completed}/${payload.total}`
            });
          }
          break;

        case 'MODEL_LOADED':
          this.isLoaded = true;
          this.isLoading = false;
          this.resolveRequest(id, true);
          break;

        case 'EMBEDDING_RESULT':
          this.resolveRequest(id, payload.embedding);
          break;

        case 'BATCH_RESULT':
          this.resolveRequest(id, payload.embeddings);
          break;

        case 'PONG':
          this.resolveRequest(id, payload);
          break;

        case 'ERROR':
          console.error('[EmbeddingClient] Worker error:', payload.message);
          this.rejectRequest(id, new Error(payload.message));
          break;
      }
    };

    this.worker.onerror = (error) => {
      console.error('[EmbeddingClient] Worker error:', error);
      this.isLoading = false;
    };
  }

  /**
   * Send a message to the worker and wait for response
   */
  sendMessage(type, payload = {}) {
    return new Promise((resolve, reject) => {
      this.initWorker();

      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({ type, id, payload });
    });
  }

  /**
   * Resolve a pending request
   */
  resolveRequest(id, result) {
    const request = this.pendingRequests.get(id);
    if (request) {
      this.pendingRequests.delete(id);
      request.resolve(result);
    }
  }

  /**
   * Reject a pending request
   */
  rejectRequest(id, error) {
    const request = this.pendingRequests.get(id);
    if (request) {
      this.pendingRequests.delete(id);
      request.reject(error);
    }
  }

  /**
   * Load the embedding model
   */
  async loadModel(progressCallback) {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      // Wait for existing load
      while (this.isLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return this.isLoaded;
    }

    this.isLoading = true;
    this.progressCallback = progressCallback;

    try {
      await this.sendMessage('LOAD_MODEL');
      return true;
    } catch (error) {
      console.error('[EmbeddingClient] Failed to load model:', error);
      this.isLoading = false;
      return false;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text) {
    if (!this.isLoaded) {
      const loaded = await this.loadModel();
      if (!loaded) return null;
    }

    try {
      return await this.sendMessage('EMBED', { text });
    } catch (error) {
      console.error('[EmbeddingClient] Embed error:', error);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts, progressCallback) {
    if (!this.isLoaded) {
      const loaded = await this.loadModel();
      if (!loaded) return texts.map(() => null);
    }

    this.progressCallback = progressCallback;

    try {
      return await this.sendMessage('EMBED_BATCH', { texts });
    } catch (error) {
      console.error('[EmbeddingClient] Batch embed error:', error);
      return texts.map(() => null);
    }
  }

  /**
   * Check if model is available
   */
  async ping() {
    try {
      return await this.sendMessage('PING');
    } catch (error) {
      return { loaded: false };
    }
  }

  /**
   * Cleanup
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isLoaded = false;
    this.isLoading = false;
    this.pendingRequests.clear();
  }
}
