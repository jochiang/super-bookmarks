/**
 * Loading Indicator Component
 */

import { div } from '../utils/dom-helpers.js';

export class LoadingIndicator {
  constructor(options = {}) {
    this.message = options.message || 'Loading...';
    this.showProgress = options.showProgress || false;
    this.progress = options.progress || 0;
    this.element = null;
  }

  /**
   * Render the component
   */
  render() {
    this.element = div({ className: 'loading-indicator' });

    // Spinner
    const spinner = div({ className: 'spinner' });
    this.element.appendChild(spinner);

    // Message
    const messageEl = div({
      className: 'loading-text',
      id: 'loading-message',
      text: this.message
    });
    this.element.appendChild(messageEl);

    // Progress bar (optional)
    if (this.showProgress) {
      const progressBar = div({ className: 'progress-bar' });
      const progressFill = div({
        className: 'progress-fill',
        id: 'progress-fill',
        style: { width: `${this.progress}%` }
      });
      progressBar.appendChild(progressFill);
      this.element.appendChild(progressBar);
    }

    return this.element;
  }

  /**
   * Update the message
   */
  setMessage(message) {
    this.message = message;
    const messageEl = this.element?.querySelector('#loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Update the progress
   */
  setProgress(progress) {
    this.progress = progress;
    const progressFill = this.element?.querySelector('#progress-fill');
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
  }
}

/**
 * Show a full-screen loading overlay
 */
export function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.querySelector('#loading-overlay');

  if (!overlay) {
    overlay = div({ className: 'loading-overlay', id: 'loading-overlay' });
    document.body.appendChild(overlay);
  }

  const indicator = new LoadingIndicator({ message, showProgress: true });
  overlay.innerHTML = '';
  overlay.appendChild(indicator.render());
  overlay.classList.remove('hidden');

  return {
    setMessage: (msg) => indicator.setMessage(msg),
    setProgress: (p) => indicator.setProgress(p),
    hide: () => overlay.classList.add('hidden')
  };
}
