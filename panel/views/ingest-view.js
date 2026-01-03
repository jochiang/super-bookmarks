/**
 * Ingest View
 * Main view for adding new notes/bookmarks
 */

import { createElement, div, label, input, textarea, button, clearElement } from '../utils/dom-helpers.js';
import { TagInput } from '../components/tag-input.js';
import { generateId } from '../../lib/db/schema.js';

export class IngestView {
  constructor(controller) {
    this.controller = controller;
    this.state = controller.state.getState();
    this.element = null;
    this.tagInput = null;
    this.unsubscribers = [];

    // Form elements
    this.titleInput = null;
    this.urlInput = null;
    this.contentArea = null;
  }

  /**
   * Render the view
   */
  render() {
    this.element = div({ className: 'ingest-view' });

    // Title field
    const titleGroup = div({ className: 'form-group' });
    titleGroup.appendChild(label({ className: 'form-label', text: 'Title' }));
    this.titleInput = input({
      type: 'text',
      className: 'form-input',
      placeholder: 'Enter a title...',
      value: this.state.ingest.title
    });
    titleGroup.appendChild(this.titleInput);
    this.element.appendChild(titleGroup);

    // URL field
    const urlGroup = div({ className: 'form-group' });
    urlGroup.appendChild(label({ className: 'form-label', text: 'URL (optional)' }));
    this.urlInput = input({
      type: 'url',
      className: 'form-input',
      placeholder: 'https://...',
      value: this.state.ingest.url || ''
    });
    urlGroup.appendChild(this.urlInput);
    this.element.appendChild(urlGroup);

    // Content/Notes area
    const contentGroup = div({ className: 'form-group' });
    const contentLabel = div({ className: 'flex justify-between items-center mb-sm' });
    contentLabel.appendChild(label({ className: 'form-label', text: 'Content / Notes', style: { marginBottom: 0 } }));

    const charCount = createElement('span', {
      className: 'text-sm text-muted',
      id: 'char-count',
      text: '0 characters'
    });
    contentLabel.appendChild(charCount);
    contentGroup.appendChild(contentLabel);

    this.contentArea = textarea({
      className: 'form-textarea content-area',
      placeholder: 'Enter your notes or highlight text on any page and right-click to add it here...',
      value: this.state.ingest.content
    });
    this.contentArea.style.minHeight = '200px';
    contentGroup.appendChild(this.contentArea);
    this.element.appendChild(contentGroup);

    // Tags
    const tagsGroup = div({ className: 'form-group' });
    tagsGroup.appendChild(label({ className: 'form-label', text: 'Tags' }));

    this.tagInput = new TagInput({
      tags: this.state.ingest.tags,
      placeholder: 'Add tags (press Enter or comma to add)',
      onChange: (tags) => this.handleTagsChange(tags),
      getSuggestions: (prefix) => this.controller.db.searchTags(prefix)
    });
    tagsGroup.appendChild(this.tagInput.render());
    this.element.appendChild(tagsGroup);

    // Action buttons
    const actions = div({ className: 'flex gap-sm mt-md' });

    this.saveBtn = button({
      className: 'btn btn-primary btn-block',
      text: 'Save Bookmark',
      id: 'save-btn',
      onClick: () => this.handleSave()
    });
    actions.appendChild(this.saveBtn);

    const clearBtn = button({
      className: 'btn btn-ghost',
      text: 'Clear',
      onClick: () => this.handleClear()
    });
    actions.appendChild(clearBtn);

    this.deleteBtn = button({
      className: 'btn btn-danger',
      text: 'Delete',
      id: 'delete-btn',
      onClick: () => this.handleDeleteNote()
    });
    this.deleteBtn.style.display = 'none';
    actions.appendChild(this.deleteBtn);

    this.element.appendChild(actions);

    // Session info (shows when appending content)
    const sessionInfo = div({
      className: 'session-info mt-md text-sm text-muted hidden',
      id: 'session-info'
    });
    this.element.appendChild(sessionInfo);

    return this.element;
  }

  /**
   * Called when view is mounted
   */
  mount() {
    // Set up input event listeners
    this.titleInput.addEventListener('input', () => this.handleInputChange());
    this.urlInput.addEventListener('input', () => this.handleInputChange());
    this.contentArea.addEventListener('input', () => this.handleContentChange());

    // Update character count and edit mode UI
    this.updateCharCount();
    this.updateUIForEditMode();

    // Focus title if empty, otherwise focus content
    if (!this.state.ingest.title) {
      this.titleInput.focus();
    } else if (this.state.ingest.isEditing) {
      this.contentArea.focus();
    }
  }

  /**
   * Called when view is unmounted
   */
  unmount() {
    // Save current state
    this.syncToState();
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  /**
   * Sync form values to state
   */
  syncToState() {
    this.state.ingest.title = this.titleInput.value;
    this.state.ingest.url = this.urlInput.value || null;
    this.state.ingest.content = this.contentArea.value;
  }

  /**
   * Handle input changes
   */
  handleInputChange() {
    this.state.ingest.isDirty = true;
    this.syncToState();
  }

  /**
   * Handle content area changes
   */
  handleContentChange() {
    this.state.ingest.isDirty = true;
    this.state.ingest.content = this.contentArea.value;
    this.updateCharCount();
  }

  /**
   * Handle tags change
   */
  handleTagsChange(tags) {
    this.state.ingest.tags = tags;
    this.state.ingest.isDirty = true;
  }

  /**
   * Update character count display
   */
  updateCharCount() {
    const count = this.contentArea.value.length;
    const countEl = this.element.querySelector('#char-count');
    if (countEl) {
      countEl.textContent = `${count.toLocaleString()} characters`;
    }
  }

  /**
   * Handle save button click
   */
  async handleSave() {
    const title = this.titleInput.value.trim();
    const content = this.contentArea.value.trim();

    if (!title && !content) {
      this.controller.showNotification('Please enter a title or content', 'warning');
      return;
    }

    this.saveBtn.disabled = true;
    this.saveBtn.textContent = 'Saving...';
    this.state.ingest.isSaving = true;

    try {
      // Create the note
      const url = this.urlInput.value.trim() || null;

      // Only include favicon if there's a URL
      const favicon = url ? this.state.ingest.favicon : null;

      const note = await this.controller.db.saveNote({
        id: this.state.ingest.sessionId || generateId(),
        title: title || 'Untitled',
        url: url,
        content: content,
        tags: this.tagInput.getTags(),
        favicon: favicon
      });

      // Generate embedding if we have content
      if (content && this.controller.embeddings) {
        try {
          // Show loading state for model if not loaded
          if (!this.controller.embeddings.isLoaded) {
            this.controller.state.getState().model.isLoading = true;
            this.controller.state.getState().model.loadProgressText = 'Loading AI model...';
          }

          const embedding = await this.controller.embeddings.embed(content);
          if (embedding) {
            await this.controller.db.saveEmbedding(note.id, embedding);
          }

          this.controller.state.getState().model.isLoading = false;
          this.controller.state.getState().model.isLoaded = true;

          // Invalidate search cache
          if (this.controller.vectorSearch) {
            this.controller.vectorSearch.invalidateCache();
          }
        } catch (embeddingError) {
          console.error('Failed to generate embedding:', embeddingError);
          // Note is still saved, just without embedding
          this.controller.state.getState().model.isLoading = false;
        }
      }

      this.controller.showNotification('Bookmark saved!', 'success');
      this.handleClear();

    } catch (error) {
      console.error('Failed to save:', error);
      this.controller.showNotification('Failed to save: ' + error.message, 'error');
    } finally {
      this.saveBtn.disabled = false;
      this.updateUIForEditMode();
      this.state.ingest.isSaving = false;
    }
  }

  /**
   * Handle clear button click
   */
  handleClear() {
    this.titleInput.value = '';
    this.urlInput.value = '';
    this.contentArea.value = '';
    this.tagInput.clear();

    this.state.ingest.title = '';
    this.state.ingest.url = null;
    this.state.ingest.content = '';
    this.state.ingest.tags = [];
    this.state.ingest.favicon = null;
    this.state.ingest.isDirty = false;
    this.state.ingest.sessionId = null;
    this.state.ingest.isEditing = false;

    this.updateCharCount();
    this.hideSessionInfo();
    this.updateUIForEditMode();

    this.titleInput.focus();
  }

  /**
   * Append content from context menu selection
   * - For URL-based notes: URL is the unique key (DB lookup)
   * - For no-URL notes: Use session-based tracking
   * - Always auto-saves immediately
   */
  async appendContent(text, url, title, favicon) {
    try {
      let existingNote = null;
      let isAppending = false;

      if (url) {
        // URL-based: look up by URL in database
        existingNote = await this.controller.db.getNoteByUrl(url);
      } else {
        // No-URL: check if we have a current no-URL session
        const currentSessionId = this.state.ingest.sessionId;
        const currentUrl = this.state.ingest.url;

        if (currentSessionId && !currentUrl) {
          // We have an active no-URL session, load it from DB
          existingNote = await this.controller.db.getNote(currentSessionId);
        }
      }

      let note;

      if (existingNote) {
        // Append to existing bookmark
        isAppending = true;
        const separator = existingNote.content ? '\n\n---\n\n' : '';
        const newContent = existingNote.content + separator + text;

        note = await this.controller.db.saveNote({
          ...existingNote,
          content: newContent,
          // Update title only if existing is 'Untitled'
          title: existingNote.title === 'Untitled' && title ? title : existingNote.title
        });
      } else {
        // Create new bookmark
        note = await this.controller.db.saveNote({
          id: generateId(),
          title: title || 'Untitled',
          url: url || null,
          content: text,
          tags: [],
          favicon: url ? favicon : null
        });
      }

      // Generate/update embedding
      if (note.content && this.controller.embeddings) {
        try {
          const embedding = await this.controller.embeddings.embed(note.content);
          if (embedding) {
            await this.controller.db.saveEmbedding(note.id, embedding);
          }
          if (this.controller.vectorSearch) {
            this.controller.vectorSearch.invalidateCache();
          }
        } catch (embeddingError) {
          console.error('Failed to generate embedding:', embeddingError);
        }
      }

      // Load the saved note into the form (edit mode)
      this.loadNoteIntoForm(note);

      // Scroll to bottom of content area
      this.contentArea.scrollTop = this.contentArea.scrollHeight;

      const message = isAppending ? 'Text appended & saved!' : 'Bookmark saved!';
      this.controller.showNotification(message, 'success', 1500);

    } catch (error) {
      console.error('Failed to save:', error);
      this.controller.showNotification('Failed to save: ' + error.message, 'error');
    }
  }

  /**
   * Load a note into the form (for editing)
   */
  loadNoteIntoForm(note) {
    // Update state
    this.state.ingest.sessionId = note.id;
    this.state.ingest.title = note.title;
    this.state.ingest.url = note.url;
    this.state.ingest.content = note.content;
    this.state.ingest.tags = note.tags || [];
    this.state.ingest.favicon = note.favicon;
    this.state.ingest.isDirty = false;
    this.state.ingest.isEditing = true;

    // Update form elements
    this.titleInput.value = note.title || '';
    this.urlInput.value = note.url || '';
    this.contentArea.value = note.content || '';
    this.tagInput.setTags(note.tags || []);

    this.updateCharCount();
    this.updateUIForEditMode();
    this.showSessionInfo();
  }

  /**
   * Set page info (when bookmarking a page without selection)
   */
  setPageInfo(url, title, favicon) {
    if (!this.state.ingest.sessionId) {
      this.state.ingest.sessionId = generateId();
    }

    if (url) {
      this.urlInput.value = url;
      this.state.ingest.url = url;
    }

    if (title) {
      this.titleInput.value = title;
      this.state.ingest.title = title;
    }

    if (favicon) {
      this.state.ingest.favicon = favicon;
    }

    this.contentArea.focus();
  }

  /**
   * Show session info
   */
  showSessionInfo() {
    const sessionInfo = this.element.querySelector('#session-info');
    if (sessionInfo) {
      sessionInfo.classList.remove('hidden');
      sessionInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--color-success);">●</span>
          <span>Session active - continue adding selections from this page</span>
        </div>
      `;
    }
  }

  /**
   * Hide session info
   */
  hideSessionInfo() {
    const sessionInfo = this.element.querySelector('#session-info');
    if (sessionInfo) {
      sessionInfo.classList.add('hidden');
    }
  }

  /**
   * Update UI for edit mode (change button text, show/hide delete, lock URL)
   */
  updateUIForEditMode() {
    const isEditing = this.state.ingest.isEditing;

    if (this.saveBtn) {
      this.saveBtn.textContent = isEditing ? 'Update Bookmark' : 'Save Bookmark';
    }

    if (this.deleteBtn) {
      this.deleteBtn.style.display = isEditing ? 'block' : 'none';
    }

    // Lock URL field when editing (URL is the unique key)
    if (this.urlInput) {
      this.urlInput.disabled = isEditing;
      this.urlInput.title = isEditing ? 'URL cannot be changed (it\'s the unique identifier)' : '';
    }
  }

  /**
   * Handle delete when in edit mode
   */
  async handleDeleteNote() {
    const noteId = this.state.ingest.sessionId;

    if (!noteId) {
      this.controller.showNotification('No bookmark to delete', 'warning');
      return;
    }

    if (!confirm('Delete this bookmark? This cannot be undone.')) {
      return;
    }

    try {
      await this.controller.db.deleteNote(noteId);

      if (this.controller.vectorSearch) {
        this.controller.vectorSearch.invalidateCache();
      }

      this.controller.showNotification('Bookmark deleted', 'success');
      this.handleClear();
    } catch (error) {
      console.error('Failed to delete:', error);
      this.controller.showNotification('Failed to delete: ' + error.message, 'error');
    }
  }
}
