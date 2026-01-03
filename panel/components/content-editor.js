/**
 * Content Editor Component
 * Simple text editor for note content
 */

import { div, textarea, button } from '../utils/dom-helpers.js';

export class ContentEditor {
  constructor(options = {}) {
    this.value = options.value || '';
    this.placeholder = options.placeholder || 'Enter your notes...';
    this.minHeight = options.minHeight || '200px';
    this.maxHeight = options.maxHeight || '400px';
    this.readonly = options.readonly || false;
    this.onChange = options.onChange || (() => {});

    this.element = null;
    this.textareaEl = null;
  }

  /**
   * Render the component
   */
  render() {
    this.element = div({ className: 'content-editor' });

    // Toolbar (optional, for future formatting features)
    const toolbar = div({ className: 'content-editor-toolbar' });

    const charCount = div({
      className: 'text-sm text-muted',
      id: 'editor-char-count',
      text: `${this.value.length} characters`
    });
    toolbar.appendChild(charCount);

    this.element.appendChild(toolbar);

    // Textarea
    this.textareaEl = textarea({
      className: 'form-textarea content-area',
      placeholder: this.placeholder,
      value: this.value
    });

    this.textareaEl.style.minHeight = this.minHeight;
    this.textareaEl.style.maxHeight = this.maxHeight;

    if (this.readonly) {
      this.textareaEl.readOnly = true;
    }

    this.element.appendChild(this.textareaEl);

    // Set up events
    this.setupEvents();

    return this.element;
  }

  /**
   * Set up event listeners
   */
  setupEvents() {
    this.textareaEl.addEventListener('input', () => {
      this.value = this.textareaEl.value;
      this.updateCharCount();
      this.onChange(this.value);
    });
  }

  /**
   * Update character count
   */
  updateCharCount() {
    const countEl = this.element.querySelector('#editor-char-count');
    if (countEl) {
      countEl.textContent = `${this.value.length} characters`;
    }
  }

  /**
   * Get the current value
   */
  getValue() {
    return this.textareaEl.value;
  }

  /**
   * Set the value
   */
  setValue(value) {
    this.value = value;
    this.textareaEl.value = value;
    this.updateCharCount();
  }

  /**
   * Append content with separator
   */
  appendContent(content, separator = '\n\n---\n\n') {
    const current = this.getValue();
    const sep = current ? separator : '';
    this.setValue(current + sep + content);

    // Scroll to bottom
    this.textareaEl.scrollTop = this.textareaEl.scrollHeight;
  }

  /**
   * Clear the content
   */
  clear() {
    this.setValue('');
  }

  /**
   * Focus the editor
   */
  focus() {
    this.textareaEl.focus();
  }

  /**
   * Set readonly state
   */
  setReadonly(readonly) {
    this.readonly = readonly;
    this.textareaEl.readOnly = readonly;
  }
}
