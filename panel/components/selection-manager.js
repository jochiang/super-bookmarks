/**
 * Selection Manager Component
 * Handles multi-select functionality across views
 */

import { div, button, span } from '../utils/dom-helpers.js';

export class SelectionManager {
  constructor(options = {}) {
    this.selectedIds = new Set(options.selectedIds || []);
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.onExport = options.onExport || (() => {});
    this.onClear = options.onClear || (() => {});

    this.element = null;
  }

  /**
   * Render the selection bar
   */
  render() {
    this.element = div({
      className: `selection-bar ${this.selectedIds.size > 0 ? 'visible' : ''}`
    });

    // Selection count
    const countSection = div({ className: 'selection-count' });
    countSection.innerHTML = `
      <strong id="selection-count">${this.selectedIds.size}</strong> items selected
    `;
    this.element.appendChild(countSection);

    // Actions
    const actions = div({ className: 'selection-actions' });

    const clearBtn = button({
      className: 'btn btn-ghost btn-sm',
      text: 'Clear',
      onClick: () => this.clearSelection()
    });
    actions.appendChild(clearBtn);

    const exportBtn = button({
      className: 'btn btn-secondary btn-sm',
      text: 'Export Selected',
      onClick: () => this.exportSelected()
    });
    actions.appendChild(exportBtn);

    this.element.appendChild(actions);

    return this.element;
  }

  /**
   * Add an ID to selection
   */
  add(id) {
    this.selectedIds.add(id);
    this.updateUI();
    this.onSelectionChange(Array.from(this.selectedIds));
  }

  /**
   * Remove an ID from selection
   */
  remove(id) {
    this.selectedIds.delete(id);
    this.updateUI();
    this.onSelectionChange(Array.from(this.selectedIds));
  }

  /**
   * Toggle selection of an ID
   */
  toggle(id) {
    if (this.selectedIds.has(id)) {
      this.remove(id);
    } else {
      this.add(id);
    }
  }

  /**
   * Check if an ID is selected
   */
  isSelected(id) {
    return this.selectedIds.has(id);
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedIds.clear();
    this.updateUI();
    this.onSelectionChange([]);
    this.onClear();
  }

  /**
   * Set multiple selections at once
   */
  setSelection(ids) {
    this.selectedIds = new Set(ids);
    this.updateUI();
    this.onSelectionChange(ids);
  }

  /**
   * Get all selected IDs
   */
  getSelection() {
    return Array.from(this.selectedIds);
  }

  /**
   * Get selection count
   */
  getCount() {
    return this.selectedIds.size;
  }

  /**
   * Update the UI
   */
  updateUI() {
    if (!this.element) return;

    const count = this.selectedIds.size;
    const countEl = this.element.querySelector('#selection-count');
    if (countEl) {
      countEl.textContent = count;
    }

    // Show/hide bar
    this.element.classList.toggle('visible', count > 0);
  }

  /**
   * Export selected items
   */
  exportSelected() {
    this.onExport(this.getSelection());
  }
}

/**
 * Create and attach selection manager to the document
 */
export function createGlobalSelectionManager(options = {}) {
  const manager = new SelectionManager(options);
  const element = manager.render();

  // Append to body if not already present
  const existing = document.querySelector('.selection-bar');
  if (existing) {
    existing.replaceWith(element);
  } else {
    document.body.appendChild(element);
  }

  return manager;
}
