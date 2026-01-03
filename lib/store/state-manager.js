/**
 * Lightweight Pub/Sub State Manager with Proxy-based reactivity
 * No external dependencies
 */

export class StateManager {
  constructor(initialState = {}) {
    this.listeners = new Map();
    this.state = this.createProxy(initialState);
  }

  /**
   * Create a reactive proxy for the state object
   */
  createProxy(obj, path = '') {
    const self = this;

    return new Proxy(obj, {
      get(target, prop) {
        if (prop === '__isProxy') return true;
        if (prop === '__path') return path;

        const value = target[prop];

        // Return proxy for nested objects (but not arrays or special types)
        if (value && typeof value === 'object' && !Array.isArray(value) &&
            !(value instanceof Date) && !(value instanceof Set) && !(value instanceof Map)) {
          if (!value.__isProxy) {
            target[prop] = self.createProxy(value, path ? `${path}.${String(prop)}` : String(prop));
          }
          return target[prop];
        }

        return value;
      },

      set(target, prop, value) {
        const oldValue = target[prop];

        // Don't notify if value hasn't changed
        if (oldValue === value) return true;

        target[prop] = value;
        const fullPath = path ? `${path}.${String(prop)}` : String(prop);
        self.notify(fullPath, value, oldValue);

        return true;
      }
    });
  }

  /**
   * Subscribe to state changes
   * @param {string} path - Dot notation path (e.g., 'ingest.title' or '*' for all)
   * @param {Function} callback - Called with (newValue, oldValue, path)
   * @returns {Function} Unsubscribe function
   */
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    this.listeners.get(path).add(callback);

    // Return unsubscribe function
    return () => {
      const pathListeners = this.listeners.get(path);
      if (pathListeners) {
        pathListeners.delete(callback);
        if (pathListeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }

  /**
   * Notify listeners of state changes
   */
  notify(path, newValue, oldValue) {
    // Notify exact path listeners
    if (this.listeners.has(path)) {
      this.listeners.get(path).forEach(cb => cb(newValue, oldValue, path));
    }

    // Notify wildcard listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => cb(newValue, oldValue, path));
    }

    // Notify parent path wildcards (e.g., 'ingest.*' matches 'ingest.title')
    const parts = path.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const wildcardPath = [...parts.slice(0, i), '*'].join('.');
      if (this.listeners.has(wildcardPath)) {
        this.listeners.get(wildcardPath).forEach(cb => cb(newValue, oldValue, path));
      }
    }
  }

  /**
   * Get current state (returns the proxy)
   */
  getState() {
    return this.state;
  }

  /**
   * Get a value at a specific path
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  /**
   * Set a value at a specific path
   */
  set(path, value) {
    const parts = path.split('.');
    const lastKey = parts.pop();
    const target = parts.reduce((obj, key) => obj[key], this.state);

    if (target && lastKey) {
      target[lastKey] = value;
    }
  }

  /**
   * Update multiple values at once
   */
  update(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
  }

  /**
   * Reset state to initial values
   */
  reset(initialState) {
    // Clear and rebuild the proxy
    for (const key of Object.keys(this.state)) {
      delete this.state[key];
    }

    for (const [key, value] of Object.entries(initialState)) {
      this.state[key] = value;
    }
  }
}

// Create a singleton state manager
let globalStateManager = null;

export function createStateManager(initialState) {
  globalStateManager = new StateManager(initialState);
  return globalStateManager;
}

export function getStateManager() {
  if (!globalStateManager) {
    throw new Error('StateManager not initialized. Call createStateManager first.');
  }
  return globalStateManager;
}
