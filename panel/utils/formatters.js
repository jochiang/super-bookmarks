/**
 * Formatting Utilities
 */

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

/**
 * Format a timestamp as date string
 */
export function formatDate(timestamp, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };

  return new Date(timestamp).toLocaleDateString(undefined, defaultOptions);
}

/**
 * Format a timestamp as date and time
 */
export function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a URL for display (shortened)
 */
export function formatUrl(url, maxLength = 40) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    let display = parsed.hostname.replace(/^www\./, '');

    if (parsed.pathname && parsed.pathname !== '/') {
      display += parsed.pathname;
    }

    if (display.length > maxLength) {
      return display.slice(0, maxLength - 3) + '...';
    }

    return display;
  } catch {
    return url.slice(0, maxLength);
  }
}

/**
 * Extract domain from URL
 */
export function getDomain(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Format similarity score as percentage
 */
export function formatScore(score) {
  return `${Math.round(score * 100)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Highlight search terms in text
 */
export function highlightText(text, searchTerms) {
  if (!searchTerms || !text) return text;

  const terms = Array.isArray(searchTerms) ? searchTerms : [searchTerms];
  let result = text;

  for (const term of terms) {
    if (!term) continue;
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format tags for display
 */
export function formatTags(tags) {
  if (!tags || tags.length === 0) return '';
  return tags.map(t => `#${t}`).join(' ');
}

/**
 * Parse tags from a string (comma or space separated)
 */
export function parseTags(input) {
  if (!input) return [];

  return input
    .split(/[,\s]+/)
    .map(t => t.replace(/^#/, '').trim().toLowerCase())
    .filter(t => t.length > 0)
    .filter((t, i, arr) => arr.indexOf(t) === i); // unique
}

/**
 * Generate excerpt from content
 */
export function generateExcerpt(content, maxLength = 200) {
  if (!content) return '';

  // Remove extra whitespace
  const cleaned = content.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) return cleaned;

  // Try to break at word boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Convert markdown-like formatting to HTML
 */
export function simpleMarkdown(text) {
  if (!text) return '';

  return text
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');
}
