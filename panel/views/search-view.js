/**
 * Search View
 * Semantic search interface
 */

import { div, input, button, span, clearElement } from '../utils/dom-helpers.js';
import { NoteCard } from '../components/note-card.js';
import { debounce } from '../utils/dom-helpers.js';

export class SearchView {
  constructor(controller) {
    this.controller = controller;
    this.state = controller.state.getState();
    this.element = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.unsubscribers = [];
  }

  /**
   * Render the view
   */
  render() {
    this.element = div({ className: 'search-view' });

    // Search bar
    const searchBar = div({ className: 'search-bar' });

    const searchIcon = span({
      className: 'search-icon',
      html: '&#128269;' // Magnifying glass
    });
    searchBar.appendChild(searchIcon);

    this.searchInput = input({
      type: 'text',
      className: 'search-input',
      placeholder: 'Search bookmarks... (use tag: for tags only)',
      value: this.state.search.query
    });
    searchBar.appendChild(this.searchInput);

    const clearBtn = button({
      className: 'search-clear',
      text: '×',
      onClick: () => this.clearSearch()
    });
    searchBar.appendChild(clearBtn);

    this.element.appendChild(searchBar);

    // Model status indicator
    const modelStatus = div({
      className: 'model-status text-sm mb-md',
      id: 'model-status'
    });
    this.updateModelStatus(modelStatus);
    this.element.appendChild(modelStatus);

    // Bulk action bar
    this.bulkActionBar = div({ className: 'bulk-action-bar' });
    this.element.appendChild(this.bulkActionBar);

    // Results container
    this.resultsContainer = div({ className: 'search-results' });
    this.element.appendChild(this.resultsContainer);

    // Render existing results if any
    if (this.state.search.hasSearched) {
      this.renderResults();
    } else {
      this.renderEmptyState();
    }

    return this.element;
  }

  /**
   * Called when view is mounted
   */
  mount() {
    // Set up debounced search
    const debouncedSearch = debounce(() => this.handleSearch(), 300);

    this.searchInput.addEventListener('input', () => {
      this.state.search.query = this.searchInput.value;
      if (this.searchInput.value.length >= 2) {
        debouncedSearch();
      } else if (this.searchInput.value.length === 0) {
        this.clearSearch();
      }
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });

    // Focus search input
    this.searchInput.focus();

    // Subscribe to state changes
    this.unsubscribers.push(
      this.controller.state.subscribe('model.*', () => {
        const statusEl = this.element.querySelector('#model-status');
        if (statusEl) {
          this.updateModelStatus(statusEl);
        }
      })
    );
  }

  /**
   * Called when view is unmounted
   */
  unmount() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  /**
   * Parse search query for modifiers (e.g., tag:)
   */
  parseSearchQuery(query) {
    // Check for tag: prefix
    const tagMatch = query.match(/^tag:\s*(.+)$/i);

    if (tagMatch) {
      return {
        type: 'tag',
        terms: tagMatch[1].split(/\s+/).filter(t => t.length > 0)
      };
    }

    return {
      type: 'keyword',
      terms: query.split(/\s+/).filter(w => w.length > 1)
    };
  }

  /**
   * Handle search
   */
  async handleSearch() {
    const query = this.searchInput.value.trim();

    if (!query || query.length < 2) {
      return;
    }

    this.state.search.isSearching = true;
    this.state.search.error = null;
    this.renderSearchingState();

    try {
      let results;
      let notice = null;

      // Parse query for modifiers
      const parsed = this.parseSearchQuery(query);

      if (parsed.type === 'tag') {
        // Tag-only search
        notice = 'Searching tags only';
        results = await this.controller.vectorSearch.tagSearch(parsed.terms, 20);
      } else {
        // Try semantic search first if model is available
        const embedding = await this.controller.embeddings.embed(query);

        if (embedding) {
          // Use semantic search with optional keyword boost
          results = await this.controller.vectorSearch.hybridSearch(embedding, parsed.terms, {
            limit: 20,
            semanticWeight: 0.7,
            keywordWeight: 0.3
          });
        } else {
          // Fall back to keyword search
          notice = 'Using keyword search (AI model loading...)';
          results = await this.controller.vectorSearch.keywordSearch(parsed.terms, 20);
        }
      }

      this.state.search.results = results;
      this.state.search.hasSearched = true;
      this.state.search.isSearching = false;

      this.renderResults(notice);
    } catch (error) {
      console.error('Search error:', error);
      this.state.search.isSearching = false;
      this.renderError(error.message);
    }
  }

  /**
   * Clear search
   */
  clearSearch() {
    this.searchInput.value = '';
    this.state.search.query = '';
    this.state.search.results = [];
    this.state.search.hasSearched = false;
    this.state.search.selectedIds = [];
    this.renderEmptyState();
  }

  /**
   * Update model status indicator
   */
  updateModelStatus(element) {
    // Check actual embedding client state
    const embeddings = this.controller.embeddings;
    const isLoaded = embeddings?.isLoaded || false;
    const isLoading = embeddings?.isLoading || false;

    if (isLoading) {
      element.innerHTML = `
        <span style="color: var(--color-warning);">●</span>
        Loading AI model...
      `;
    } else if (isLoaded) {
      element.innerHTML = `
        <span style="color: var(--color-success);">●</span>
        AI-powered semantic search ready
      `;
    } else {
      element.innerHTML = `
        <span style="color: var(--text-muted);">●</span>
        AI model will load on first search
      `;
    }
  }

  /**
   * Render searching state
   */
  renderSearchingState() {
    clearElement(this.resultsContainer);

    const searching = div({ className: 'text-center mt-md' });
    searching.innerHTML = `
      <div class="spinner" style="margin: 0 auto;"></div>
      <p class="text-muted mt-sm">Searching...</p>
    `;

    this.resultsContainer.appendChild(searching);
  }

  /**
   * Render search results
   */
  renderResults(notice = null) {
    clearElement(this.resultsContainer);

    const results = this.state.search.results;

    // Stats bar
    const statsBar = div({ className: 'stats-bar' });
    statsBar.innerHTML = `
      <div class="stat-item">
        <span class="stat-value">${results.length}</span>
        <span>results found</span>
      </div>
    `;
    this.resultsContainer.appendChild(statsBar);

    // Notice (e.g., fallback to keyword search)
    if (notice) {
      const noticeEl = div({
        className: 'text-sm text-muted mb-md',
        text: notice
      });
      this.resultsContainer.appendChild(noticeEl);
    }

    if (results.length === 0) {
      const noResults = div({ className: 'empty-state' });
      noResults.innerHTML = `
        <div class="empty-state-title">No matches found</div>
        <p class="empty-state-text">Try different keywords or phrases</p>
      `;
      this.resultsContainer.appendChild(noResults);
      return;
    }

    // Render note cards
    results.forEach(note => {
      const card = new NoteCard(note, {
        showCheckbox: true,
        showScore: true,
        isSelected: this.state.search.selectedIds.includes(note.id),
        onSelect: (id, selected) => this.handleSelect(id, selected),
        onEdit: (note) => this.handleEdit(note),
        onDelete: (note) => this.handleDelete(note)
      });

      this.resultsContainer.appendChild(card.render());
    });
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    clearElement(this.resultsContainer);

    const empty = div({ className: 'empty-state' });
    empty.innerHTML = `
      <div class="empty-state-icon">&#128270;</div>
      <div class="empty-state-title">Search your bookmarks</div>
      <p class="empty-state-text">
        Enter keywords or describe what you're looking for.<br>
        The AI will find semantically similar content.
      </p>
    `;

    this.resultsContainer.appendChild(empty);
  }

  /**
   * Render error state
   */
  renderError(message) {
    clearElement(this.resultsContainer);

    const error = div({ className: 'empty-state' });
    error.innerHTML = `
      <div class="empty-state-icon" style="color: var(--color-error);">!</div>
      <div class="empty-state-title">Search failed</div>
      <p class="empty-state-text">${message}</p>
    `;

    this.resultsContainer.appendChild(error);
  }

  /**
   * Handle note selection
   */
  handleSelect(id, selected) {
    const selectedIds = this.state.search.selectedIds;

    if (selected && !selectedIds.includes(id)) {
      this.state.search.selectedIds = [...selectedIds, id];
    } else if (!selected) {
      this.state.search.selectedIds = selectedIds.filter(i => i !== id);
    }

    this.renderBulkActionBar();
  }

  /**
   * Render bulk action bar
   */
  renderBulkActionBar() {
    const selectedCount = this.state.search.selectedIds.length;

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
    const selectedIds = this.state.search.selectedIds;
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
    const selectedIds = this.state.search.selectedIds;
    const count = selectedIds.length;

    if (!confirm(`Delete ${count} bookmark${count > 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }

    try {
      for (const id of selectedIds) {
        await this.controller.db.deleteNote(id);
      }

      this.controller.vectorSearch.invalidateCache();
      this.state.search.results = this.state.search.results.filter(
        n => !selectedIds.includes(n.id)
      );
      this.state.search.selectedIds = [];

      this.renderResults();
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

      // Remove from results
      this.state.search.results = this.state.search.results.filter(n => n.id !== note.id);
      this.state.search.selectedIds = this.state.search.selectedIds.filter(id => id !== note.id);

      this.renderResults();
      this.renderBulkActionBar();
      this.controller.showNotification('Bookmark deleted', 'success');
    } catch (error) {
      this.controller.showNotification('Failed to delete: ' + error.message, 'error');
    }
  }
}
