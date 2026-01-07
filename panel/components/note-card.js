/**
 * Note Card Component
 * Displays a single note/bookmark with expand/collapse functionality
 */

import { createElement, div, span, button, input } from '../utils/dom-helpers.js';
import { formatRelativeTime, formatUrl, formatScore, truncate } from '../utils/formatters.js';

export class NoteCard {
  constructor(note, options = {}) {
    this.note = note;
    this.isExpanded = options.isExpanded || false;
    this.isSelected = options.isSelected || false;
    this.showCheckbox = options.showCheckbox || false;
    this.showScore = options.showScore || false;

    // Callbacks
    this.onSelect = options.onSelect || (() => {});
    this.onExpand = options.onExpand || (() => {});
    this.onEdit = options.onEdit || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onClick = options.onClick || (() => {});

    this.element = null;
  }

  /**
   * Render the card
   */
  render() {
    this.element = div({
      className: `note-card ${this.isExpanded ? 'expanded' : ''} ${this.isSelected ? 'selected' : ''}`,
      dataset: { id: this.note.id }
    });

    // Header
    const header = div({ className: 'note-card-header' });

    // Checkbox for multi-select
    if (this.showCheckbox) {
      const checkbox = input({
        type: 'checkbox',
        className: 'note-card-checkbox',
        checked: this.isSelected,
        onClick: (e) => {
          e.stopPropagation();
          this.isSelected = e.target.checked;
          this.element.classList.toggle('selected', this.isSelected);
          this.onSelect(this.note.id, this.isSelected);
        }
      });
      header.appendChild(checkbox);
    }

    // Favicon
    if (this.note.favicon) {
      const favicon = createElement('img', {
        className: 'note-card-favicon',
        src: this.note.favicon,
        alt: ''
      });
      favicon.onerror = () => favicon.style.display = 'none';
      header.appendChild(favicon);
    }

    // Title
    const title = div({
      className: 'note-card-title',
      text: this.note.title || 'Untitled'
    });
    header.appendChild(title);

    this.element.appendChild(header);

    // Click handler for card (expand/collapse)
    this.element.addEventListener('click', (e) => {
      if (e.target.closest('.note-card-checkbox') ||
          e.target.closest('.note-card-actions') ||
          e.target.closest('button')) {
        return;
      }
      this.toggle();
      this.onClick(this.note);
    });

    // Excerpt (only when collapsed)
    if (!this.isExpanded && this.note.excerpt) {
      const excerpt = div({
        className: 'note-card-excerpt',
        text: truncate(this.note.excerpt, 150)
      });
      this.element.appendChild(excerpt);
    }

    // Meta info
    const meta = div({ className: 'note-card-meta' });

    // Score (for search results)
    if (this.showScore && this.note.score !== undefined) {
      const score = span({
        className: 'note-card-score',
        text: formatScore(this.note.score)
      });
      meta.appendChild(score);
    }

    // URL
    if (this.note.url) {
      const url = createElement('a', {
        className: 'note-card-url',
        href: this.note.url,
        target: '_blank',
        text: formatUrl(this.note.url, 30),
        onClick: (e) => e.stopPropagation()
      });
      meta.appendChild(url);
    }

    // Date
    const date = span({
      text: formatRelativeTime(this.note.updatedAt)
    });
    meta.appendChild(date);

    // Tags
    if (this.note.tags && this.note.tags.length > 0) {
      const tagsContainer = span({ text: this.note.tags.map(t => `#${t}`).join(' ') });
      tagsContainer.style.color = 'var(--accent-secondary)';
      meta.appendChild(tagsContainer);
    }

    this.element.appendChild(meta);

    // Expanded content
    if (this.isExpanded) {
      this.renderExpandedContent();
    }

    return this.element;
  }

  /**
   * Render expanded content section
   */
  renderExpandedContent() {
    const content = div({ className: 'note-card-content' });

    // Full content text
    const contentText = div({
      className: 'note-card-content-text',
      text: this.note.content || '(No content)'
    });
    content.appendChild(contentText);

    // Action buttons
    const actions = div({ className: 'note-card-actions' });

    const editBtn = button({
      className: 'btn btn-secondary btn-sm',
      text: 'Edit',
      onClick: (e) => {
        e.stopPropagation();
        this.onEdit(this.note);
      }
    });
    actions.appendChild(editBtn);

    if (this.note.url) {
      const openBtn = button({
        className: 'btn btn-secondary btn-sm',
        text: 'Open URL',
        onClick: (e) => {
          e.stopPropagation();
          window.open(this.note.url, '_blank');
        }
      });
      actions.appendChild(openBtn);
    }

    const deleteBtn = button({
      className: 'btn btn-danger btn-sm',
      text: 'Delete',
      onClick: (e) => {
        e.stopPropagation();
        if (confirm('Delete this bookmark?')) {
          this.onDelete(this.note);
        }
      }
    });
    actions.appendChild(deleteBtn);

    content.appendChild(actions);
    this.element.appendChild(content);
  }

  /**
   * Toggle expanded state
   */
  toggle() {
    this.isExpanded = !this.isExpanded;

    // Save reference to old element before render creates new one
    const oldElement = this.element;
    const parent = oldElement?.parentNode;

    if (!parent) return; // Guard against element not in DOM

    const newElement = this.render();

    try {
      parent.replaceChild(newElement, oldElement);
    } catch (e) {
      // DOM may have changed (e.g., list re-rendered during click), ignore
    }

    this.onExpand(this.note.id, this.isExpanded);
  }

  /**
   * Set selected state
   */
  setSelected(selected) {
    this.isSelected = selected;
    this.element.classList.toggle('selected', selected);

    const checkbox = this.element.querySelector('.note-card-checkbox');
    if (checkbox) {
      checkbox.checked = selected;
    }
  }

  /**
   * Update the note data
   */
  update(note) {
    this.note = note;

    // Save reference to old element before render creates new one
    const oldElement = this.element;
    const parent = oldElement?.parentNode;

    if (!parent) return; // Guard against element not in DOM

    const newElement = this.render();

    try {
      parent.replaceChild(newElement, oldElement);
    } catch (e) {
      // DOM may have changed (e.g., list re-rendered), ignore
    }
  }
}

/**
 * Create a list of note cards
 */
export function createNoteCardList(notes, options = {}) {
  const container = div({ className: 'note-card-list' });

  notes.forEach(note => {
    const card = new NoteCard(note, {
      showCheckbox: options.showCheckbox,
      showScore: options.showScore,
      isSelected: options.selectedIds?.includes(note.id),
      onSelect: options.onSelect,
      onExpand: options.onExpand,
      onEdit: options.onEdit,
      onDelete: options.onDelete,
      onClick: options.onClick
    });

    container.appendChild(card.render());
  });

  return container;
}
