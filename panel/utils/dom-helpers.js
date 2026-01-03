/**
 * DOM Helper Utilities
 */

/**
 * Query selector shorthand
 */
export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

/**
 * Create an element with attributes and children
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (key === 'text') {
      el.textContent = value;
    } else if (key === 'value') {
      // Set value as property, not attribute (for inputs/textareas)
      el.value = value;
    } else if (key === 'checked') {
      // Set checked as property, not attribute (for checkboxes)
      el.checked = !!value;
    } else if (key === 'disabled') {
      // Set disabled as property
      el.disabled = !!value;
    } else {
      el.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Shorthand for creating common elements
 */
export const div = (attrs, children) => createElement('div', attrs, children);
export const span = (attrs, children) => createElement('span', attrs, children);
export const button = (attrs, children) => createElement('button', attrs, children);
export const input = (attrs) => createElement('input', attrs);
export const textarea = (attrs) => createElement('textarea', attrs);
export const label = (attrs, children) => createElement('label', attrs, children);

/**
 * Remove all children from an element
 */
export function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Show/hide element
 */
export function show(el) {
  el.classList.remove('hidden');
}

export function hide(el) {
  el.classList.add('hidden');
}

export function toggle(el, visible) {
  el.classList.toggle('hidden', !visible);
}

/**
 * Add event listener with automatic cleanup
 */
export function on(el, event, handler, options) {
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

/**
 * Delegate event handling
 */
export function delegate(parent, selector, event, handler) {
  const listener = (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) {
      handler(e, target);
    }
  };

  parent.addEventListener(event, listener);
  return () => parent.removeEventListener(event, listener);
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Parse HTML string to element
 */
export function parseHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}
