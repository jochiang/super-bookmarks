/**
 * Export View
 * Export and backup functionality
 */

import { div, button, span, label, clearElement, createElement } from '../utils/dom-helpers.js';
import { formatDateTime, formatFileSize, formatNumber } from '../utils/formatters.js';
import { notesToMarkdown, downloadFile, generateExportFilename } from '../../lib/export/markdown-exporter.js';
import {
  downloadDatabaseBackup,
  importDatabase,
  validateBackupFile
} from '../../lib/export/backup-manager.js';

export class ExportView {
  constructor(controller) {
    this.controller = controller;
    this.state = controller.state.getState();
    this.element = null;
    this.notesToExport = null; // Pre-selected notes from multi-select
  }

  /**
   * Set notes to export (from multi-select)
   */
  setNotesToExport(notes) {
    this.notesToExport = notes;
  }

  /**
   * Render the view
   */
  render() {
    this.element = div({ className: 'export-view' });

    // Header
    const header = createElement('h2', { text: 'Export & Backup', style: { marginBottom: '16px' } });
    this.element.appendChild(header);

    // Selected notes info (if any)
    if (this.notesToExport && this.notesToExport.length > 0) {
      const selectedInfo = div({
        className: 'stats-bar mb-md',
        style: { background: 'rgba(0, 212, 255, 0.1)' }
      });
      selectedInfo.innerHTML = `
        <div class="stat-item">
          <span class="stat-value">${this.notesToExport.length}</span>
          <span>bookmarks selected for export</span>
        </div>
      `;
      this.element.appendChild(selectedInfo);
    }

    // Tabs
    const tabs = div({ className: 'tabs' });

    const exportTab = button({
      className: 'tab active',
      text: 'Export',
      dataset: { tab: 'export' },
      onClick: (e) => this.switchTab(e, 'export')
    });
    tabs.appendChild(exportTab);

    const backupTab = button({
      className: 'tab',
      text: 'Backup/Restore',
      dataset: { tab: 'backup' },
      onClick: (e) => this.switchTab(e, 'backup')
    });
    tabs.appendChild(backupTab);

    this.element.appendChild(tabs);

    // Tab content
    const tabContent = div({ id: 'tab-content' });
    this.element.appendChild(tabContent);

    // Render initial tab
    this.renderExportTab();

    return this.element;
  }

  /**
   * Called when view is mounted
   */
  mount() {
    // Auto-open preview if notes were pre-selected from bulk export
    if (this.notesToExport && this.notesToExport.length > 0) {
      // Small delay to let the view render first
      setTimeout(() => this.handlePreview(), 100);
    }
  }

  /**
   * Called when view is unmounted
   */
  unmount() {
    this.notesToExport = null;
  }

  /**
   * Switch between tabs
   */
  switchTab(e, tabName) {
    // Update tab buttons
    this.element.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // Render tab content
    if (tabName === 'export') {
      this.renderExportTab();
    } else {
      this.renderBackupTab();
    }
  }

  /**
   * Render export tab
   */
  renderExportTab() {
    const content = this.element.querySelector('#tab-content');
    clearElement(content);

    // Export to Markdown section
    const markdownSection = div({ className: 'section mb-md' });

    const markdownHeader = createElement('h3', {
      text: 'Export to Markdown',
      style: { marginBottom: '8px' }
    });
    markdownSection.appendChild(markdownHeader);

    const markdownDesc = createElement('p', {
      className: 'text-sm text-muted mb-md',
      text: 'Download your bookmarks as a readable markdown file.'
    });
    markdownSection.appendChild(markdownDesc);

    // Export options
    const optionsRow = div({ className: 'flex gap-md mb-md' });

    // Selected only or all
    const scopeLabel = div({ className: 'flex items-center gap-sm' });

    const scopeSelect = document.createElement('select');
    scopeSelect.className = 'form-input';
    scopeSelect.style.width = 'auto';
    scopeSelect.id = 'export-scope';

    if (this.notesToExport && this.notesToExport.length > 0) {
      scopeSelect.innerHTML = `
        <option value="selected">Selected (${this.notesToExport.length})</option>
        <option value="all">All bookmarks</option>
      `;
    } else {
      scopeSelect.innerHTML = `
        <option value="all">All bookmarks</option>
      `;
    }

    scopeLabel.appendChild(span({ text: 'Export:', className: 'text-sm' }));
    scopeLabel.appendChild(scopeSelect);
    optionsRow.appendChild(scopeLabel);

    markdownSection.appendChild(optionsRow);

    // Export button
    const exportBtn = button({
      className: 'btn btn-primary',
      text: 'Download Markdown',
      onClick: () => this.handleExportMarkdown()
    });
    markdownSection.appendChild(exportBtn);

    content.appendChild(markdownSection);

    // Export to HTML section
    const htmlSection = div({ className: 'section mb-md' });

    const htmlHeader = createElement('h3', {
      text: 'Preview in Browser',
      style: { marginBottom: '8px' }
    });
    htmlSection.appendChild(htmlHeader);

    const htmlDesc = createElement('p', {
      className: 'text-sm text-muted mb-md',
      text: 'Open your bookmarks in a new browser tab for viewing or printing.'
    });
    htmlSection.appendChild(htmlDesc);

    const previewBtn = button({
      className: 'btn btn-secondary',
      text: 'Open Preview',
      onClick: () => this.handlePreview()
    });
    htmlSection.appendChild(previewBtn);

    content.appendChild(htmlSection);
  }

  /**
   * Render backup tab
   */
  renderBackupTab() {
    const content = this.element.querySelector('#tab-content');
    clearElement(content);

    // Full backup section
    const backupSection = div({ className: 'section mb-md' });

    const backupHeader = createElement('h3', {
      text: 'Full Database Backup',
      style: { marginBottom: '8px' }
    });
    backupSection.appendChild(backupHeader);

    const backupDesc = createElement('p', {
      className: 'text-sm text-muted mb-md',
      text: 'Export all data including AI embeddings. Use this to migrate to another device or browser.'
    });
    backupSection.appendChild(backupDesc);

    const backupBtn = button({
      className: 'btn btn-primary',
      text: 'Download Full Backup',
      id: 'backup-btn',
      onClick: () => this.handleBackup()
    });
    backupSection.appendChild(backupBtn);

    content.appendChild(backupSection);

    // Restore section
    const restoreSection = div({ className: 'section mb-md' });

    const restoreHeader = createElement('h3', {
      text: 'Restore from Backup',
      style: { marginBottom: '8px' }
    });
    restoreSection.appendChild(restoreHeader);

    const restoreDesc = createElement('p', {
      className: 'text-sm text-muted mb-md',
      text: 'Import a previously exported backup file.'
    });
    restoreSection.appendChild(restoreDesc);

    // File drop zone
    const dropZone = div({ className: 'drop-zone', id: 'drop-zone' });
    dropZone.innerHTML = `
      <div class="drop-zone-icon">&#128193;</div>
      <p class="drop-zone-text">Drop backup file here or click to browse</p>
      <p class="drop-zone-hint">Accepts .json backup files</p>
    `;
    restoreSection.appendChild(dropZone);

    // Hidden file input
    const fileInput = createElement('input', {
      type: 'file',
      accept: '.json',
      style: { display: 'none' },
      id: 'file-input'
    });
    restoreSection.appendChild(fileInput);

    // Restore options (hidden until file selected)
    const restoreOptions = div({
      className: 'mt-md hidden',
      id: 'restore-options'
    });
    restoreSection.appendChild(restoreOptions);

    content.appendChild(restoreSection);

    // Set up drop zone
    this.setupDropZone();
  }

  /**
   * Set up drop zone functionality
   */
  setupDropZone() {
    const dropZone = this.element.querySelector('#drop-zone');
    const fileInput = this.element.querySelector('#file-input');

    if (!dropZone || !fileInput) return;

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelected(e.target.files[0]);
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    });
  }

  /**
   * Handle export to markdown
   */
  async handleExportMarkdown() {
    const scopeSelect = this.element.querySelector('#export-scope');
    const scope = scopeSelect?.value || 'all';

    let notes;

    if (scope === 'selected' && this.notesToExport) {
      notes = this.notesToExport;
    } else {
      // Get all notes
      notes = await this.controller.db.getAllNotes({ limit: 10000 });
    }

    if (notes.length === 0) {
      this.controller.showNotification('No bookmarks to export', 'warning');
      return;
    }

    const markdown = notesToMarkdown(notes);
    const filename = generateExportFilename('bookmarks', 'md');

    downloadFile(markdown, filename, 'text/markdown');

    this.controller.showNotification(`Exported ${notes.length} bookmarks`, 'success');
  }

  /**
   * Handle preview in browser
   */
  async handlePreview() {
    const scopeSelect = this.element.querySelector('#export-scope');
    const scope = scopeSelect?.value || 'all';

    let notes;

    if (scope === 'selected' && this.notesToExport) {
      notes = this.notesToExport;
    } else {
      notes = await this.controller.db.getAllNotes({ limit: 10000 });
    }

    if (notes.length === 0) {
      this.controller.showNotification('No bookmarks to preview', 'warning');
      return;
    }

    // Generate HTML
    const html = this.generatePreviewHTML(notes);

    // Open in new tab
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  /**
   * Generate HTML for preview
   */
  generatePreviewHTML(notes) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Super Bookmarks Export</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #e8e8e8; }
    h1 { border-bottom: 2px solid #00d4ff; padding-bottom: 10px; }
    .note { background: #16213e; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .note-title { font-size: 1.2em; font-weight: bold; margin-bottom: 8px; color: #00d4ff; }
    .note-url { color: #a0a0a0; font-size: 0.9em; margin-bottom: 8px; }
    .note-url a { color: #00d4ff; }
    .note-tags { margin-bottom: 8px; }
    .tag { display: inline-block; background: #7b2cbf; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 4px; }
    .note-content { white-space: pre-wrap; color: #a0a0a0; }
    .meta { font-size: 0.8em; color: #6b7280; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Super Bookmarks Export</h1>
  <p>Exported ${formatNumber(notes.length)} bookmarks on ${formatDateTime(Date.now())}</p>

  ${notes.map(note => `
  <div class="note">
    <div class="note-title">${this.escapeHtml(note.title || 'Untitled')}</div>
    ${note.url ? `<div class="note-url"><a href="${this.escapeHtml(note.url)}" target="_blank">${this.escapeHtml(note.url)}</a></div>` : ''}
    ${note.tags && note.tags.length > 0 ? `<div class="note-tags">${note.tags.map(t => `<span class="tag">#${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="note-content">${this.escapeHtml(note.content || '(No content)')}</div>
    <div class="meta">Created: ${formatDateTime(note.createdAt)} | Updated: ${formatDateTime(note.updatedAt)}</div>
  </div>
  `).join('')}
</body>
</html>`;
  }

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Handle full backup
   */
  async handleBackup() {
    const btn = this.element.querySelector('#backup-btn');
    btn.disabled = true;
    btn.textContent = 'Creating backup...';

    try {
      const result = await downloadDatabaseBackup(this.controller.db);

      this.controller.showNotification(
        `Backup created: ${result.notesCount} notes, ${formatFileSize(result.size)}`,
        'success'
      );
    } catch (error) {
      this.controller.showNotification('Backup failed: ' + error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Download Full Backup';
    }
  }

  /**
   * Handle file selected for restore
   */
  async handleFileSelected(file) {
    const optionsEl = this.element.querySelector('#restore-options');
    optionsEl.classList.remove('hidden');
    clearElement(optionsEl);

    // Validate file
    const validation = await validateBackupFile(file);

    if (!validation.isValid) {
      optionsEl.innerHTML = `
        <div style="color: var(--color-error);">
          <strong>Invalid backup file</strong>
          <ul>${validation.errors.map(e => `<li>${e}</li>`).join('')}</ul>
        </div>
      `;
      return;
    }

    // Show file info
    const { stats } = validation;
    optionsEl.innerHTML = `
      <div class="stats-bar mb-md">
        <div class="stat-item">
          <span class="stat-value">${formatNumber(stats.notesCount)}</span>
          <span>notes</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${formatNumber(stats.embeddingsCount)}</span>
          <span>embeddings</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${formatNumber(stats.tagsCount)}</span>
          <span>tags</span>
        </div>
      </div>
      <p class="text-sm text-muted mb-md">
        Backup from: ${stats.exportedAt ? formatDateTime(stats.exportedAt) : 'Unknown'}
      </p>
      <div class="flex items-center gap-sm mb-md">
        <input type="checkbox" id="clear-existing" />
        <label for="clear-existing" class="text-sm">Replace existing data (clear before import)</label>
      </div>
    `;

    const restoreBtn = button({
      className: 'btn btn-primary',
      text: 'Restore Backup',
      onClick: () => this.handleRestore(file)
    });
    optionsEl.appendChild(restoreBtn);
  }

  /**
   * Handle restore from backup
   */
  async handleRestore(file) {
    const clearExisting = this.element.querySelector('#clear-existing')?.checked || false;

    if (clearExisting) {
      if (!confirm('This will delete all existing bookmarks. Are you sure?')) {
        return;
      }
    }

    const optionsEl = this.element.querySelector('#restore-options');
    optionsEl.innerHTML = `
      <div class="text-center">
        <div class="spinner" style="margin: 0 auto;"></div>
        <p class="text-muted mt-sm" id="restore-status">Importing...</p>
      </div>
    `;

    try {
      const result = await importDatabase(this.controller.db, file, {
        clearExisting,
        onProgress: (progress) => {
          const statusEl = this.element.querySelector('#restore-status');
          if (statusEl) {
            statusEl.textContent = progress.message;
          }
        }
      });

      // Invalidate caches
      if (this.controller.vectorSearch) {
        this.controller.vectorSearch.invalidateCache();
      }

      this.controller.showNotification(
        `Restored ${result.notesImported} notes, ${result.embeddingsImported} embeddings`,
        'success'
      );

      // Re-render backup tab
      this.renderBackupTab();

    } catch (error) {
      this.controller.showNotification('Restore failed: ' + error.message, 'error');
      this.renderBackupTab();
    }
  }
}
