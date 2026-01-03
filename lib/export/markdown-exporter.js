/**
 * Markdown Exporter
 * Export notes to markdown format
 */

import { formatDateTime } from '../../panel/utils/formatters.js';

/**
 * Export a single note to markdown
 */
export function noteToMarkdown(note) {
  let md = '';

  // Title
  md += `# ${note.title || 'Untitled'}\n\n`;

  // Metadata
  if (note.url) {
    md += `**URL:** [${note.url}](${note.url})\n`;
  }

  md += `**Created:** ${formatDateTime(note.createdAt)}\n`;
  md += `**Updated:** ${formatDateTime(note.updatedAt)}\n`;

  if (note.tags && note.tags.length > 0) {
    md += `**Tags:** ${note.tags.map(t => `#${t}`).join(' ')}\n`;
  }

  md += '\n---\n\n';

  // Content
  md += note.content || '*No content*';
  md += '\n';

  return md;
}

/**
 * Export multiple notes to a single markdown file
 */
export function notesToMarkdown(notes, options = {}) {
  const {
    title = 'Super Bookmarks Export',
    includeTableOfContents = true
  } = options;

  let md = '';

  // Header
  md += `# ${title}\n\n`;
  md += `*Exported on ${formatDateTime(Date.now())}*\n\n`;
  md += `Total bookmarks: ${notes.length}\n\n`;

  // Table of contents
  if (includeTableOfContents && notes.length > 3) {
    md += '## Table of Contents\n\n';

    notes.forEach((note, index) => {
      const anchor = slugify(note.title || `untitled-${index}`);
      md += `${index + 1}. [${note.title || 'Untitled'}](#${anchor})\n`;
    });

    md += '\n---\n\n';
  }

  // Notes
  notes.forEach((note, index) => {
    // Add anchor for TOC
    const anchor = slugify(note.title || `untitled-${index}`);
    md += `<a id="${anchor}"></a>\n\n`;

    md += noteToMarkdown(note);

    // Separator between notes
    if (index < notes.length - 1) {
      md += '\n---\n\n';
    }
  });

  return md;
}

/**
 * Create a slug from text for anchors
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Download content as a file
 */
export function downloadFile(content, filename, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Generate filename for export
 */
export function generateExportFilename(prefix = 'bookmarks', extension = 'md') {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  return `${prefix}-${dateStr}.${extension}`;
}
