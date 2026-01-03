/**
 * Embedding Worker (ES Module)
 * Web Worker for running transformers.js model
 * Runs in a separate thread to prevent UI blocking
 */

// Import from bundled transformers.js library
import { pipeline as pipelineFn, env } from '../vendor/transformers.min.js';

let embedder = null;
let isLoading = false;

/**
 * Load the embedding model
 */
async function loadModel() {
  if (embedder) return embedder;
  if (isLoading) {
    // Wait for existing load
    while (isLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return embedder;
  }

  isLoading = true;

  try {
    self.postMessage({
      type: 'PROGRESS',
      payload: { status: 'loading', message: 'Loading transformers.js library...' }
    });

    // Configure environment
    if (env) {
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Disable multi-threading to avoid blob worker CSP issues
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.proxy = false;
      }
    }

    self.postMessage({
      type: 'PROGRESS',
      payload: { status: 'downloading', message: 'Downloading AI model (~23MB)...' }
    });

    // Load the embedding model with progress callback
    embedder = await pipelineFn('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (progress) => {
        if (progress.status === 'progress' && progress.progress) {
          self.postMessage({
            type: 'PROGRESS',
            payload: {
              status: 'downloading',
              progress: progress.progress,
              file: progress.file || '',
              loaded: progress.loaded || 0,
              total: progress.total || 0,
              message: `Downloading: ${Math.round(progress.progress)}%`
            }
          });
        } else if (progress.status === 'done') {
          self.postMessage({
            type: 'PROGRESS',
            payload: { status: 'done', message: 'Model loaded!' }
          });
        }
      }
    });

    self.postMessage({
      type: 'PROGRESS',
      payload: { status: 'ready', message: 'Model ready!' }
    });

    return embedder;
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: error.message }
    });
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Generate embedding for a text
 */
async function generateEmbedding(text) {
  if (!embedder) {
    await loadModel();
  }

  // Truncate text if too long (model has max length)
  const maxLength = 512;
  const truncatedText = text.length > maxLength * 4
    ? text.slice(0, maxLength * 4)
    : text;

  const output = await embedder(truncatedText, {
    pooling: 'mean',
    normalize: true
  });

  // Convert to regular array for transfer
  return Array.from(output.data);
}

/**
 * Generate embeddings for multiple texts
 */
async function generateBatchEmbeddings(texts) {
  const embeddings = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);

    // Report progress
    self.postMessage({
      type: 'BATCH_PROGRESS',
      payload: {
        completed: embeddings.length,
        total: texts.length
      }
    });
  }

  return embeddings;
}

/**
 * Message handler
 */
self.onmessage = async (event) => {
  const { type, id, payload } = event.data;

  try {
    switch (type) {
      case 'LOAD_MODEL':
        await loadModel();
        self.postMessage({ type: 'MODEL_LOADED', id });
        break;

      case 'EMBED':
        const embedding = await generateEmbedding(payload.text);
        self.postMessage({
          type: 'EMBEDDING_RESULT',
          id,
          payload: { embedding }
        });
        break;

      case 'EMBED_BATCH':
        const embeddings = await generateBatchEmbeddings(payload.texts);
        self.postMessage({
          type: 'BATCH_RESULT',
          id,
          payload: { embeddings }
        });
        break;

      case 'PING':
        self.postMessage({
          type: 'PONG',
          id,
          payload: { loaded: !!embedder }
        });
        break;

      default:
        self.postMessage({
          type: 'ERROR',
          id,
          payload: { message: `Unknown message type: ${type}` }
        });
    }
  } catch (error) {
    console.error('[EmbeddingWorker] Error:', error);
    self.postMessage({
      type: 'ERROR',
      id,
      payload: { message: error.message }
    });
  }
};

// Let main thread know worker is ready
self.postMessage({ type: 'WORKER_READY' });
