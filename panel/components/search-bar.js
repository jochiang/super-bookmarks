/**
 * Search Bar Component
 * Reusable search input with clear button
 */

import { div, input, button, span } from '../utils/dom-helpers.js';
import { debounce } from '../utils/dom-helpers.js';

export class SearchBar {
  constructor(options = {}) {
    this.placeholder = options.placeholder || 'Search...';
    this.value = options.value || '';
    this.debounceMs = options.debounceMs || 300;
    this.onSearch = options.onSearch || (() => {});
    this.onClear = options.onClear || (() => {});
    this.onChange = options.onChange || (() => {});

    this.element = null;
    this.inputEl = null;
  }

  /**
   * Render the component
   */
  render() {
    this.element = div({ className: 'search-bar' });

    // Search icon
    const icon = span({
      className: 'search-icon',
      html: '&#128269;'
    });
    this.element.appendChild(icon);

    // Input
    this.inputEl = input({
      type: 'text',
      className: 'search-input',
      placeholder: this.placeholder,
      value: this.value
    });
    this.element.appendChild(this.inputEl);

    // Clear button
    const clearBtn = button({
      className: 'search-clear',
      text: '×',
      onClick: () => this.clear()
    });
    this.element.appendChild(clearBtn);

    // Set up event listeners
    this.setupEvents();

    return this.element;
  }

  /**
   * Set up event listeners
   */
  setupEvents() {
    const debouncedSearch = debounce(() => {
      this.onSearch(this.inputEl.value);
    }, this.debounceMs);

    this.inputEl.addEventListener('input', () => {
      this.value = this.inputEl.value;
      this.onChange(this.value);
      debouncedSearch();
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.onSearch(this.inputEl.value);
      } else if (e.key === 'Escape') {
        this.clear();
      }
    });
  }

  /**
   * Clear the search
   */
  clear() {
    this.inputEl.value = '';
    this.value = '';
    this.onClear();
  }

  /**
   * Focus the input
   */
  focus() {
    this.inputEl.focus();
  }

  /**
   * Set the value
   */
  setValue(value) {
    this.value = value;
    this.inputEl.value = value;
  }

  /**
   * Get the current value
   */
  getValue() {
    return this.inputEl.value;
  }
}
