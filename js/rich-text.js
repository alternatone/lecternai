/**
 * Rich Text Utility for Lectern
 * Supports bold, italic, and bullet points in textareas
 * Uses markdown-style syntax: **bold**, *italic*, - bullets
 */

const RichText = {
    /**
     * Convert markdown-style text to HTML
     * @param {string} text - Plain text with markdown
     * @returns {string} - HTML string
     */
    toHTML(text) {
        if (!text) return '';

        // Escape HTML first
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Convert **bold** to <strong>
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Convert *italic* to <em> (but not if it's part of **)
        html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

        // Convert line breaks
        const lines = html.split('\n');
        let result = [];
        let inList = false;

        for (let line of lines) {
            const trimmed = line.trim();
            const isBullet = /^[-•]\s/.test(trimmed);

            if (isBullet) {
                if (!inList) {
                    result.push('<ul style="margin: 0.5rem 0; padding-left: 1.5rem;">');
                    inList = true;
                }
                const content = trimmed.replace(/^[-•]\s/, '');
                result.push(`<li>${content}</li>`);
            } else {
                if (inList) {
                    result.push('</ul>');
                    inList = false;
                }
                if (trimmed) {
                    result.push(line + '<br>');
                } else {
                    result.push('<br>');
                }
            }
        }

        if (inList) {
            result.push('</ul>');
        }

        // Remove trailing <br>
        let finalHtml = result.join('');
        while (finalHtml.endsWith('<br>')) {
            finalHtml = finalHtml.slice(0, -4);
        }

        return finalHtml;
    },

    /**
     * Convert HTML back to markdown-style text
     * @param {string} html - HTML string
     * @returns {string} - Plain text with markdown
     */
    toMarkdown(html) {
        if (!html) return '';

        let text = html;

        // Convert <strong> and <b> to **bold**
        text = text.replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**');

        // Convert <em> and <i> to *italic*
        text = text.replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*');

        // Convert <li> to bullet points
        text = text.replace(/<li>(.*?)<\/li>/gi, '- $1\n');

        // Remove <ul> and </ul> tags
        text = text.replace(/<\/?ul[^>]*>/gi, '');

        // Convert <br> and <br/> to newlines
        text = text.replace(/<br\s*\/?>/gi, '\n');

        // Convert <p> tags to double newlines
        text = text.replace(/<p>/gi, '');
        text = text.replace(/<\/p>/gi, '\n\n');

        // Remove any remaining HTML tags
        text = text.replace(/<[^>]+>/g, '');

        // Decode HTML entities
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&quot;/g, '"');

        // Clean up multiple newlines
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    },

    /**
     * Handle paste event to preserve formatting
     * @param {ClipboardEvent} e - Paste event
     * @param {HTMLTextAreaElement} textarea - Target textarea
     */
    handlePaste(e, textarea) {
        e.preventDefault();

        // Try to get HTML content first
        let html = e.clipboardData.getData('text/html');
        let text;

        if (html) {
            // Convert HTML to markdown
            text = RichText.toMarkdown(html);
        } else {
            // Fall back to plain text
            text = e.clipboardData.getData('text/plain');
        }

        // Insert at cursor position
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);

        textarea.value = before + text + after;

        // Move cursor to end of pasted text
        const newPos = start + text.length;
        textarea.setSelectionRange(newPos, newPos);

        // Trigger input event for any listeners
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },

    /**
     * Add keyboard shortcuts for formatting
     * Ctrl/Cmd + B = bold, Ctrl/Cmd + I = italic
     * @param {KeyboardEvent} e - Keydown event
     * @param {HTMLTextAreaElement} textarea - Target textarea
     */
    handleKeydown(e, textarea) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifier = isMac ? e.metaKey : e.ctrlKey;

        if (!modifier) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (!selectedText) return;

        let wrapper = '';

        if (e.key === 'b' || e.key === 'B') {
            wrapper = '**';
            e.preventDefault();
        } else if (e.key === 'i' || e.key === 'I') {
            wrapper = '*';
            e.preventDefault();
        }

        if (wrapper) {
            const before = textarea.value.substring(0, start);
            const after = textarea.value.substring(end);
            const newText = wrapper + selectedText + wrapper;

            textarea.value = before + newText + after;

            // Select the wrapped text (including markers)
            textarea.setSelectionRange(start, start + newText.length);

            // Trigger input event
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    /**
     * Initialize rich text support on a textarea
     * @param {HTMLTextAreaElement} textarea - Textarea element
     * @param {Object} options - Options object
     * @param {boolean} options.showHint - Show formatting hint below textarea
     */
    init(textarea, options = {}) {
        if (!textarea || textarea.dataset.richTextInit) return;

        textarea.dataset.richTextInit = 'true';

        textarea.addEventListener('paste', (e) => RichText.handlePaste(e, textarea));
        textarea.addEventListener('keydown', (e) => RichText.handleKeydown(e, textarea));

        // Add formatting hint if requested
        if (options.showHint && !textarea.nextElementSibling?.classList?.contains('rich-text-hint')) {
            const hint = document.createElement('div');
            hint.className = 'rich-text-hint';
            hint.style.cssText = 'font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;';
            hint.innerHTML = 'Supports <strong>**bold**</strong>, <em>*italic*</em>, and <span>- bullet points</span>. Cmd/Ctrl+B/I for shortcuts.';
            textarea.parentNode.insertBefore(hint, textarea.nextSibling);
        }
    },

    /**
     * Initialize rich text on all textareas matching a selector
     * @param {string} selector - CSS selector
     */
    initAll(selector) {
        document.querySelectorAll(selector).forEach(textarea => {
            RichText.init(textarea);
        });
    }
};

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RichText;
}
