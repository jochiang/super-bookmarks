/**
 * Tag Input Component
 * Allows adding and removing tags with autocomplete
 */

import { createElement, div, span, button, input } from '../utils/dom-helpers.js';

export class TagInput {
  constructor(options = {}) {
    this.tags = options.tags || [];
    this.placeholder = options.placeholder || 'Add tags...';
    this.onChange = options.onChange || (() => {});
    this.getSuggestions = options.getSuggestions || (() => Promise.resolve([]));

    this.element = null;
    this.inputEl = null;
    this.suggestionsEl = null;
    this.highlightedIndex = -1;
    this.suggestions = [];
  }

  /**
   * Render the component
   */
  render() {
    this.element = div({ className: 'tag-input-wrapper', style: { position: 'relative' } });

    const container = div({ className: 'tag-input-container' });

    // Render existing tags
    this.tags.forEach(tag => {
      container.appendChild(this.createTagElement(tag));
    });

    // Input for new tags
    this.inputEl = input({
      type: 'text',
      className: 'tag-input',
      placeholder: this.tags.length ? '' : this.placeholder
    });

    container.appendChild(this.inputEl);

    // Click container to focus input
    container.addEventListener('click', () => this.inputEl.focus());

    // Suggestions dropdown
    this.suggestionsEl = div({ className: 'tag-suggestions', style: { display: 'none' } });

    this.element.appendChild(container);
    this.element.appendChild(this.suggestionsEl);

    this.setupEventListeners();

    return this.element;
  }

  /**
   * Create a tag pill element
   */
  createTagElement(tag) {
    const tagEl = span({ className: 'tag-item' }, [tag]);

    const removeBtn = button({
      className: 'tag-item-remove',
      text: '×',
      type: 'button',
      onClick: (e) => {
        e.stopPropagation();
        this.removeTag(tag);
      }
    });

    tagEl.appendChild(removeBtn);
    return tagEl;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Input events
    this.inputEl.addEventListener('input', () => this.handleInput());
    this.inputEl.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.inputEl.addEventListener('blur', () => {
      // Delay to allow click on suggestion
      setTimeout(() => this.hideSuggestions(), 200);
    });
    this.inputEl.addEventListener('focus', () => this.handleInput());
  }

  /**
   * Handle input changes
   */
  async handleInput() {
    const value = this.inputEl.value.trim();

    if (value.length > 0) {
      this.suggestions = await this.getSuggestions(value);
      this.showSuggestions();
    } else {
      this.hideSuggestions();
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeydown(e) {
    switch (e.key) {
      case 'Enter':
      case 'Tab':
      case ',':
        e.preventDefault();
        if (this.highlightedIndex >= 0 && this.suggestions[this.highlightedIndex]) {
          this.addTag(this.suggestions[this.highlightedIndex].displayName || this.suggestions[this.highlightedIndex].name);
        } else if (this.inputEl.value.trim()) {
          this.addTag(this.inputEl.value.trim());
        }
        break;

      case 'Backspace':
        if (!this.inputEl.value && this.tags.length > 0) {
          this.removeTag(this.tags[this.tags.length - 1]);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.highlightNext();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.highlightPrev();
        break;

      case 'Escape':
        this.hideSuggestions();
        break;
    }
  }

  /**
   * Add a tag
   */
  addTag(tag) {
    const normalized = tag.toLowerCase().trim();

    if (normalized && !this.tags.includes(normalized)) {
      this.tags.push(normalized);
      this.rerender();
      this.onChange(this.tags);
    }

    this.inputEl.value = '';
    this.hideSuggestions();
  }

  /**
   * Remove a tag
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.rerender();
      this.onChange(this.tags);
    }
  }

  /**
   * Show suggestions dropdown
   */
  showSuggestions() {
    if (this.suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.suggestionsEl.innerHTML = '';
    this.highlightedIndex = -1;

    this.suggestions.forEach((suggestion, index) => {
      const name = suggestion.displayName || suggestion.name || suggestion;
      const suggestionEl = div({
        className: 'tag-suggestion',
        text: name,
        onClick: () => this.addTag(name)
      });

      suggestionEl.addEventListener('mouseenter', () => {
        this.highlightedIndex = index;
        this.updateHighlight();
      });

      this.suggestionsEl.appendChild(suggestionEl);
    });

    this.suggestionsEl.style.display = 'block';
  }

  /**
   * Hide suggestions dropdown
   */
  hideSuggestions() {
    this.suggestionsEl.style.display = 'none';
    this.suggestions = [];
    this.highlightedIndex = -1;
  }

  /**
   * Highlight next suggestion
   */
  highlightNext() {
    if (this.suggestions.length === 0) return;
    this.highlightedIndex = (this.highlightedIndex + 1) % this.suggestions.length;
    this.updateHighlight();
  }

  /**
   * Highlight previous suggestion
   */
  highlightPrev() {
    if (this.suggestions.length === 0) return;
    this.highlightedIndex = this.highlightedIndex <= 0
      ? this.suggestions.length - 1
      : this.highlightedIndex - 1;
    this.updateHighlight();
  }

  /**
   * Update highlight styling
   */
  updateHighlight() {
    const items = this.suggestionsEl.querySelectorAll('.tag-suggestion');
    items.forEach((item, index) => {
      item.classList.toggle('highlighted', index === this.highlightedIndex);
    });
  }

  /**
   * Re-render the tag list
   */
  rerender() {
    const container = this.element.querySelector('.tag-input-container');

    // Remove old tag elements (keep the input)
    const oldTags = container.querySelectorAll('.tag-item');
    oldTags.forEach(el => el.remove());

    // Add new tag elements before the input
    this.tags.forEach(tag => {
      container.insertBefore(this.createTagElement(tag), this.inputEl);
    });

    // Update placeholder
    this.inputEl.placeholder = this.tags.length ? '' : this.placeholder;
  }

  /**
   * Set tags programmatically
   */
  setTags(tags) {
    this.tags = [...tags];
    this.rerender();
  }

  /**
   * Get current tags
   */
  getTags() {
    return [...this.tags];
  }

  /**
   * Clear all tags
   */
  clear() {
    this.tags = [];
    this.inputEl.value = '';
    this.rerender();
  }
}
