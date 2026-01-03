/**
 * Browse View
 * View and manage all bookmarks
 */

import { div, button, span, clearElement } from '../utils/dom-helpers.js';
import { NoteCard } from '../components/note-card.js';
import { formatNumber } from '../utils/formatters.js';

export class BrowseView {
  constructor(controller) {
    this.controller = controller;
    this.state = controller.state.getState();
    this.element = null;
    this.listContainer = null;
    this.unsubscribers = [];
  }

  /**
   * Render the view
   */
  render() {
    this.element = div({ className: 'browse-view' });

    // Header with stats and controls
    const header = div({ className: 'flex justify-between items-center mb-md' });

    // Stats
    const stats = div({ className: 'stats', id: 'browse-stats' });
    header.appendChild(stats);

    // Sort controls
    const controls = div({ className: 'flex gap-sm items-center' });

    const sortLabel = span({ className: 'text-sm text-muted', text: 'Sort:' });
    controls.appendChild(sortLabel);

    const sortSelect = document.createElement('select');
    sortSelect.className = 'form-input';
    sortSelect.style.width = 'auto';
    sortSelect.style.padding = '4px 8px';
    sortSelect.innerHTML = `
      <option value="updatedAt-desc">Recently Updated</option>
      <option value="createdAt-desc">Newest First</option>
      <option value="createdAt-asc">Oldest First</option>
      <option value="title-asc">Title A-Z</option>
    `;
    sortSelect.value = `${this.state.browse.sortBy}-${this.state.browse.sortOrder}`;
    sortSelect.addEventListener('change', () => this.handleSortChange(sortSelect.value));
    controls.appendChild(sortSelect);

    header.appendChild(controls);
    this.element.appendChild(header);

    // Bulk action bar
    this.bulkActionBar = div({ className: 'bulk-action-bar' });
    this.element.appendChild(this.bulkActionBar);

    // List container
    this.listContainer = div({ className: 'browse-list' });
    this.element.appendChild(this.listContainer);

    // Pagination
    const pagination = div({ className: 'pagination', id: 'pagination' });
    this.element.appendChild(pagination);

    return this.element;
  }

  /**
   * Called when view is mounted
   */
  async mount() {
    await this.loadNotes();
  }

  /**
   * Called when view is unmounted
   */
  unmount() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  /**
   * Load notes from database
   */
  async loadNotes() {
    this.state.browse.isLoading = true;
    this.renderLoading();

    try {
      const { currentPage, pageSize, sortBy, sortOrder } = this.state.browse;

      const notes = await this.controller.db.getAllNotes({
        limit: pageSize,
        offset: currentPage * pageSize,
        orderBy: sortBy,
        order: sortOrder
      });

      const totalCount = await this.controller.db.getNotesCount();

      this.state.browse.notes = notes;
      this.state.browse.hasMore = notes.length === pageSize;
      this.state.browse.isLoading = false;

      this.updateStats(totalCount);
      this.renderNotes();
      this.updatePagination(totalCount);

    } catch (error) {
      console.error('Failed to load notes:', error);
      this.state.browse.isLoading = false;
      this.renderError(error.message);
    }
  }

  /**
   * Update stats display
   */
  updateStats(totalCount) {
    const statsEl = this.element.querySelector('#browse-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="text-muted">${formatNumber(totalCount)} bookmarks</span>
      `;
    }
  }

  /**
   * Handle sort change
   */
  handleSortChange(value) {
    const [sortBy, sortOrder] = value.split('-');
    this.state.browse.sortBy = sortBy;
    this.state.browse.sortOrder = sortOrder;
    this.state.browse.currentPage = 0;
    this.loadNotes();
  }

  /**
   * Render loading state
   */
  renderLoading() {
    clearElement(this.listContainer);
    this.listContainer.innerHTML = `
      <div class="text-center mt-md">
        <div class="spinner" style="margin: 0 auto;"></div>
        <p class="text-muted mt-sm">Loading bookmarks...</p>
      </div>
    `;
  }

  /**
   * Render notes list
   */
  renderNotes() {
    clearElement(this.listContainer);

    const notes = this.state.browse.notes;

    if (notes.length === 0) {
      this.renderEmpty();
      return;
    }

    notes.forEach(note => {
      const card = new NoteCard(note, {
        showCheckbox: true,
        isSelected: this.state.browse.selectedIds.includes(note.id),
        onSelect: (id, selected) => this.handleSelect(id, selected),
        onEdit: (note) => this.handleEdit(note),
        onDelete: (note) => this.handleDelete(note)
      });

      this.listContainer.appendChild(card.render());
    });
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    this.listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128278;</div>
        <div class="empty-state-title">No bookmarks yet</div>
        <p class="empty-state-text">
          Start by adding content from the Add tab,<br>
          or right-click text on any page.
        </p>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError(message) {
    clearElement(this.listContainer);
    this.listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="color: var(--color-error);">!</div>
        <div class="empty-state-title">Failed to load</div>
        <p class="empty-state-text">${message}</p>
        <button class="btn btn-secondary mt-md" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  /**
   * Update pagination controls
   */
  updatePagination(totalCount) {
    const paginationEl = this.element.querySelector('#pagination');
    if (!paginationEl) return;

    const { currentPage, pageSize } = this.state.browse;
    const totalPages = Math.ceil(totalCount / pageSize);

    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    paginationEl.innerHTML = '';

    // Previous button
    const prevBtn = button({
      className: 'pagination-btn',
      html: '&larr;',
      disabled: currentPage === 0,
      onClick: () => this.goToPage(currentPage - 1)
    });
    paginationEl.appendChild(prevBtn);

    // Page info
    const pageInfo = span({
      className: 'pagination-info',
      text: `${currentPage + 1} / ${totalPages}`
    });
    paginationEl.appendChild(pageInfo);

    // Next button
    const nextBtn = button({
      className: 'pagination-btn',
      html: '&rarr;',
      disabled: currentPage >= totalPages - 1,
      onClick: () => this.goToPage(currentPage + 1)
    });
    paginationEl.appendChild(nextBtn);
  }

  /**
   * Go to specific page
   */
  goToPage(page) {
    this.state.browse.currentPage = page;
    this.loadNotes();

    // Scroll to top of list
    this.listContainer.scrollTop = 0;
  }

  /**
   * Handle note selection
   */
  handleSelect(id, selected) {
    const selectedIds = this.state.browse.selectedIds;

    if (selected && !selectedIds.includes(id)) {
      this.state.browse.selectedIds = [...selectedIds, id];
    } else if (!selected) {
      this.state.browse.selectedIds = selectedIds.filter(i => i !== id);
    }

    this.renderBulkActionBar();
  }

  /**
   * Render bulk action bar
   */
  renderBulkActionBar() {
    const selectedCount = this.state.browse.selectedIds.length;

    if (selectedCount === 0) {
      this.bulkActionBar.style.display = 'none';
      return;
    }

    this.bulkActionBar.style.display = 'flex';
    this.bulkActionBar.innerHTML = `
      <span class="selected-count">${selectedCount} selected</span>
      <button class="btn btn-sm btn-secondary bulk-export">Export</button>
      <button class="btn btn-sm btn-danger bulk-delete">Delete</button>
    `;

    this.bulkActionBar.querySelector('.bulk-export').onclick = () => this.handleBulkExport();
    this.bulkActionBar.querySelector('.bulk-delete').onclick = () => this.handleBulkDelete();
  }

  /**
   * Handle bulk export
   */
  async handleBulkExport() {
    const selectedIds = this.state.browse.selectedIds;
    const notes = await Promise.all(
      selectedIds.map(id => this.controller.db.getNote(id))
    );

    this.controller.views.export.setNotesToExport(notes.filter(n => n));
    this.controller.showView('export');
  }

  /**
   * Handle bulk delete
   */
  async handleBulkDelete() {
    const selectedIds = this.state.browse.selectedIds;
    const count = selectedIds.length;

    if (!confirm(`Delete ${count} bookmark${count > 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }

    try {
      for (const id of selectedIds) {
        await this.controller.db.deleteNote(id);
      }

      this.controller.vectorSearch.invalidateCache();
      this.state.browse.notes = this.state.browse.notes.filter(
        n => !selectedIds.includes(n.id)
      );
      this.state.browse.selectedIds = [];

      this.renderNotes();
      this.renderBulkActionBar();
      this.controller.showNotification(`Deleted ${count} bookmark${count > 1 ? 's' : ''}`, 'success');
    } catch (error) {
      this.controller.showNotification('Failed to delete: ' + error.message, 'error');
    }
  }

  /**
   * Handle edit action
   */
  handleEdit(note) {
    // Switch to ingest view with note loaded
    this.controller.state.getState().ingest = {
      ...this.controller.state.getState().ingest,
      title: note.title,
      url: note.url,
      content: note.content,
      tags: note.tags,
      favicon: note.favicon,
      sessionId: note.id,
      isDirty: false,
      isEditing: true
    };

    this.controller.showView('ingest');
    this.controller.showNotification('Editing bookmark', 'info');
  }

  /**
   * Handle delete action
   */
  async handleDelete(note) {
    try {
      await this.controller.db.deleteNote(note.id);
      this.controller.vectorSearch.invalidateCache();

      // Remove from list
      this.state.browse.notes = this.state.browse.notes.filter(n => n.id !== note.id);
      this.state.browse.selectedIds = this.state.browse.selectedIds.filter(id => id !== note.id);

      this.renderNotes();
      this.renderBulkActionBar();
      this.controller.showNotification('Bookmark deleted', 'success');
    } catch (error) {
      this.controller.showNotification('Failed to delete: ' + error.message, 'error');
    }
  }

  /**
   * Select all visible notes
   */
  selectAll() {
    const ids = this.state.browse.notes.map(n => n.id);
    this.state.browse.selectedIds = ids;
    this.renderNotes();
  }

  /**
   * Deselect all notes
   */
  deselectAll() {
    this.state.browse.selectedIds = [];
    this.renderNotes();
  }
}
