/**
 * Rich Text Utility for Lectern
 * Preserves HTML formatting (bold, italic, links, bullets) from pasted content
 * Stores clean HTML directly - no markdown conversion
 */

const RichText = {
    /**
     * Clean and sanitize HTML for safe storage and display
     * Preserves: bold, italic, links, lists, line breaks
     * Removes: scripts, styles, Word junk, unsafe attributes
     * @param {string} html - Raw HTML string
     * @returns {string} - Clean HTML string
     */
    cleanHTML(html) {
        if (!html) return '';

        let text = html;

        // Remove Microsoft Word/Office specific markup
        text = text.replace(/<o:p[^>]*>.*?<\/o:p>/gi, '');
        text = text.replace(/<o:p[^>]*\/>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        text = text.replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, '');
        text = text.replace(/<!--\[if[^>]*>[\s\S]*?<!\[endif\]-->/gi, '');
        text = text.replace(/<!--[\s\S]*?-->/gi, '');
        text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

        // Remove mso- styles and Word class attributes
        text = text.replace(/\s*mso-[^;"']+[;"']/gi, '');
        text = text.replace(/\s*class="[^"]*Mso[^"]*"/gi, '');
        text = text.replace(/\s*class='[^']*Mso[^']*'/gi, '');

        // Convert Word-style bold spans to <strong>
        text = text.replace(/<span[^>]*style="[^"]*font-weight:\s*(bold|700)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<strong>$2</strong>');

        // Convert Word-style italic spans to <em>
        text = text.replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<em>$2</em>');

        // Normalize bold tags to <strong>
        text = text.replace(/<b(\s[^>]*)?>([\s\S]*?)<\/b>/gi, '<strong>$2</strong>');

        // Normalize italic tags to <em>
        text = text.replace(/<i(\s[^>]*)?>([\s\S]*?)<\/i>/gi, '<em>$2</em>');

        // Clean up links - preserve href but remove other attributes
        text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1" target="_blank" rel="noopener">$2</a>');
        text = text.replace(/<a\s+[^>]*href='([^']*)'[^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1" target="_blank" rel="noopener">$2</a>');

        // Clean list items - remove attributes
        text = text.replace(/<li[^>]*>/gi, '<li>');
        text = text.replace(/<ul[^>]*>/gi, '<ul>');
        text = text.replace(/<ol[^>]*>/gi, '<ol>');

        // Remove Word-specific span wrappers (but keep content)
        text = text.replace(/<span[^>]*style="[^"]*mso-[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');

        // Remove empty spans and other empty tags
        text = text.replace(/<span[^>]*>\s*<\/span>/gi, '');
        text = text.replace(/<p[^>]*>\s*<\/p>/gi, '');
        text = text.replace(/<div[^>]*>\s*<\/div>/gi, '');

        // Convert <p> tags to line breaks for cleaner storage
        text = text.replace(/<p[^>]*>/gi, '');
        text = text.replace(/<\/p>/gi, '<br><br>');

        // Convert divs to line breaks
        text = text.replace(/<div[^>]*>/gi, '');
        text = text.replace(/<\/div>/gi, '<br>');

        // Remove any remaining span tags (keep content)
        text = text.replace(/<\/?span[^>]*>/gi, '');

        // Remove "Normal" style artifacts from Word
        text = text.replace(/\bNormal\s*\d*\b/g, '');

        // Clean up excessive line breaks
        text = text.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');

        // Remove leading/trailing breaks
        text = text.replace(/^(\s*<br\s*\/?>\s*)+/gi, '');
        text = text.replace(/(\s*<br\s*\/?>\s*)+$/gi, '');

        // Decode common HTML entities
        text = text.replace(/&nbsp;/g, ' ');

        // Clean up whitespace
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/>\s+</g, '><');
        text = text.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br><br>');

        return text.trim();
    },

    /**
     * Convert plain text URLs to clickable links
     * @param {string} text - Text that may contain URLs
     * @returns {string} - Text with URLs wrapped in <a> tags
     */
    autoLinkURLs(text) {
        if (!text) return '';

        // Match URLs not already in href attributes
        const urlPattern = /(?<!href=["'])(?<!href=["'][^"']*)(https?:\/\/[^\s<>"']+)/gi;

        return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    },

    /**
     * Prepare content for display - ensures HTML is safe and links are clickable
     * @param {string} content - Stored content (may be HTML or plain text)
     * @returns {string} - Safe HTML ready for display
     */
    toDisplay(content) {
        if (!content) return '';

        // If content looks like it has HTML, clean it
        if (/<[^>]+>/.test(content)) {
            let html = this.cleanHTML(content);
            // Auto-link any plain URLs that aren't already links
            html = this.autoLinkURLs(html);
            return html;
        }

        // Plain text - escape HTML, convert line breaks, auto-link URLs
        let html = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Convert line breaks to <br>
        html = html.replace(/\n/g, '<br>');

        // Auto-link URLs
        html = this.autoLinkURLs(html);

        return html;
    },

    /**
     * Handle paste event - clean HTML and insert
     * @param {ClipboardEvent} e - Paste event
     * @param {HTMLTextAreaElement} textarea - Target textarea
     */
    handlePaste(e, textarea) {
        e.preventDefault();

        // Try to get HTML content first
        let html = e.clipboardData.getData('text/html');
        let content;

        if (html) {
            // Clean the HTML
            content = RichText.cleanHTML(html);
        } else {
            // Fall back to plain text
            content = e.clipboardData.getData('text/plain');
        }

        // Insert at cursor position
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);

        textarea.value = before + content + after;

        // Move cursor to end of pasted text
        const newPos = start + content.length;
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
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const modifier = isMac ? e.metaKey : e.ctrlKey;

        if (!modifier) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (!selectedText) return;

        let tag = '';

        if (e.key === 'b' || e.key === 'B') {
            tag = 'strong';
            e.preventDefault();
        } else if (e.key === 'i' || e.key === 'I') {
            tag = 'em';
            e.preventDefault();
        }

        if (tag) {
            const before = textarea.value.substring(0, start);
            const after = textarea.value.substring(end);
            const newText = `<${tag}>${selectedText}</${tag}>`;

            textarea.value = before + newText + after;

            // Select the wrapped text (including tags)
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
            hint.innerHTML = 'Paste formatted text from Word/Docs. Use Cmd/Ctrl+B for <strong>bold</strong>, Cmd/Ctrl+I for <em>italic</em>.';
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
    },

    // Legacy compatibility - toHTML now just calls toDisplay
    toHTML(text) {
        return this.toDisplay(text);
    },

    // Legacy compatibility - toMarkdown now just calls cleanHTML
    toMarkdown(html) {
        return this.cleanHTML(html);
    }
};

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RichText;
}
