/**
 * Rich Text Utility for Lectern
 * Enables WYSIWYG editing using contenteditable divs
 * What users see is what gets saved - no conversion needed
 */

const RichText = {
    /**
     * Clean pasted HTML - remove Word junk but keep formatting
     * @param {string} html - Raw HTML from clipboard
     * @returns {string} - Clean HTML
     */
    cleanPastedHTML(html) {
        if (!html) return '';

        let text = html;

        // Remove everything before <body> if present (Word includes full document)
        const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
            text = bodyMatch[1];
        }

        // Remove Microsoft Word/Office specific markup - be aggressive
        text = text.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '');
        text = text.replace(/<o:p[^>]*\/>/gi, '');
        text = text.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '');
        text = text.replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        text = text.replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, '');
        text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
        text = text.replace(/<meta[^>]*\/?>/gi, '');
        text = text.replace(/<link[^>]*\/?>/gi, '');
        text = text.replace(/<!DOCTYPE[^>]*>/gi, '');
        text = text.replace(/<\/?html[^>]*>/gi, '');
        text = text.replace(/<\/?body[^>]*>/gi, '');
        text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

        // Remove ALL conditional comments (Word uses these extensively)
        text = text.replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '');
        text = text.replace(/<!--\[if[^\]]*\]>/gi, '');
        text = text.replace(/<!\[endif\]-->/gi, '');
        text = text.replace(/<!--[\s\S]*?-->/gi, '');

        // Remove mso- prefixed elements and attributes
        text = text.replace(/<!\[if[^\]]*\]>/gi, '');
        text = text.replace(/<!\[endif\]>/gi, '');

        // Remove all style attributes and class attributes
        text = text.replace(/\s*style="[^"]*"/gi, '');
        text = text.replace(/\s*style='[^']*'/gi, '');
        text = text.replace(/\s*class="[^"]*"/gi, '');
        text = text.replace(/\s*class='[^']*'/gi, '');
        text = text.replace(/\s*lang="[^"]*"/gi, '');
        text = text.replace(/\s*data-[^=]*="[^"]*"/gi, '');

        // Convert Word-style bold spans to <strong> (before removing spans)
        text = text.replace(/<b(\s[^>]*)?>([\s\S]*?)<\/b>/gi, '<strong>$2</strong>');

        // Convert Word-style italic to <em>
        text = text.replace(/<i(\s[^>]*)?>([\s\S]*?)<\/i>/gi, '<em>$2</em>');

        // Clean up links - preserve href only
        text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1" target="_blank">$2</a>');
        text = text.replace(/<a\s+[^>]*href='([^']*)'[^>]*>([\s\S]*?)<\/a>/gi, '<a href="$1" target="_blank">$2</a>');

        // Clean list items - remove attributes
        text = text.replace(/<li[^>]*>/gi, '<li>');
        text = text.replace(/<ul[^>]*>/gi, '<ul>');
        text = text.replace(/<ol[^>]*>/gi, '<ol>');

        // Remove all span tags (keep content)
        text = text.replace(/<\/?span[^>]*>/gi, '');

        // Remove font tags (keep content)
        text = text.replace(/<\/?font[^>]*>/gi, '');

        // Convert <p> tags to line breaks for cleaner output
        text = text.replace(/<p[^>]*>/gi, '');
        text = text.replace(/<\/p>/gi, '<br><br>');

        // Flatten nested divs - convert to line breaks
        text = text.replace(/<div[^>]*><div[^>]*>/gi, '<div>');
        text = text.replace(/<\/div><\/div>/gi, '</div>');
        text = text.replace(/<div[^>]*>/gi, '');
        text = text.replace(/<\/div>/gi, '<br>');

        // Remove "Normal" text artifacts from Word
        text = text.replace(/\bNormal\s*\d*\b/g, '');

        // Clean up sup tags (keep them for things like 20th)
        text = text.replace(/<sup[^>]*>/gi, '<sup>');

        // Clean up excessive whitespace
        text = text.replace(/\s+/g, ' ');

        // Clean up multiple <br> tags (max 2 in a row)
        text = text.replace(/(<br\s*\/?>[\s]*){3,}/gi, '<br><br>');
        text = text.replace(/^(<br\s*\/?>[\s]*)+/gi, ''); // Remove leading breaks
        text = text.replace(/(<br\s*\/?>[\s]*)+$/gi, ''); // Remove trailing breaks

        // Clean up spaces around tags
        text = text.replace(/\s*<br\s*\/?>\s*/gi, '<br>');
        text = text.replace(/<br><br><br>/gi, '<br><br>');

        return text.trim();
    },

    /**
     * Clean already-saved content that may have raw HTML showing
     * This is for content that was saved before proper cleaning
     * @param {string} html - Potentially dirty HTML content
     * @returns {string} - Cleaned HTML
     */
    cleanSavedContent(html) {
        if (!html) return '';

        // If content appears to have visible HTML tags as text, it needs cleaning
        // This handles cases where tags weren't rendered but stored as text
        let text = html;

        // Apply the same cleaning as paste
        text = this.cleanPastedHTML(text);

        return text;
    },

    /**
     * Handle paste event for contenteditable
     * @param {ClipboardEvent} e - Paste event
     * @param {HTMLElement} element - Target contenteditable element
     */
    handlePaste(e, element) {
        e.preventDefault();

        // Try to get HTML content first
        let html = e.clipboardData.getData('text/html');
        let content;

        if (html) {
            // Clean the HTML
            content = RichText.cleanPastedHTML(html);
        } else {
            // Fall back to plain text, convert newlines to <br>
            content = e.clipboardData.getData('text/plain');
            content = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }

        // Insert at cursor position
        document.execCommand('insertHTML', false, content);

        // Trigger input event for any listeners
        element.dispatchEvent(new Event('input', { bubbles: true }));
    },

    /**
     * Handle keyboard shortcuts for formatting
     * Ctrl/Cmd + B = bold, Ctrl/Cmd + I = italic, Ctrl/Cmd + K = link
     * @param {KeyboardEvent} e - Keydown event
     * @param {HTMLElement} element - Target contenteditable element
     */
    handleKeydown(e, element) {
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const modifier = isMac ? e.metaKey : e.ctrlKey;

        if (!modifier) return;

        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            document.execCommand('bold', false, null);
        } else if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            document.execCommand('italic', false, null);
        } else if (e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            RichText.insertLink(element);
        }
    },

    /**
     * Insert or edit a link on selected text
     * @param {HTMLElement} element - The contenteditable element
     */
    insertLink(element) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();

        // Check if we're inside an existing link
        let existingLink = null;
        let node = selection.anchorNode;
        while (node && node !== element) {
            if (node.nodeName === 'A') {
                existingLink = node;
                break;
            }
            node = node.parentNode;
        }

        if (existingLink) {
            // Editing existing link - prompt with current URL
            const currentUrl = existingLink.getAttribute('href') || '';
            const newUrl = prompt('Edit link URL (leave empty to remove link):', currentUrl);

            if (newUrl === null) return; // Cancelled

            if (newUrl === '') {
                // Remove the link but keep the text
                const textNode = document.createTextNode(existingLink.textContent);
                existingLink.parentNode.replaceChild(textNode, existingLink);
            } else {
                existingLink.setAttribute('href', newUrl);
                existingLink.setAttribute('target', '_blank');
            }
        } else if (selectedText) {
            // Creating new link on selected text
            const url = prompt('Enter URL for the selected text:');

            if (!url) return; // Cancelled or empty

            // Create the link
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.textContent = selectedText;

            // Replace selection with link
            range.deleteContents();
            range.insertNode(link);

            // Move cursor after the link
            range.setStartAfter(link);
            range.setEndAfter(link);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // No selection - prompt for both text and URL
            const text = prompt('Enter link text:');
            if (!text) return;

            const url = prompt('Enter URL:');
            if (!url) return;

            // Create and insert the link
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.textContent = text;

            range.insertNode(link);

            // Move cursor after the link
            range.setStartAfter(link);
            range.setEndAfter(link);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // Trigger input event for auto-save
        element.dispatchEvent(new Event('input', { bubbles: true }));
    },

    /**
     * Get clean HTML content from a contenteditable element
     * @param {HTMLElement} element - The contenteditable element
     * @returns {string} - Clean HTML content
     */
    getContent(element) {
        if (!element) return '';
        return element.innerHTML.trim();
    },

    /**
     * Set HTML content in a contenteditable element
     * @param {HTMLElement} element - The contenteditable element
     * @param {string} html - HTML content to set
     */
    setContent(element, html) {
        if (!element) return;
        element.innerHTML = html || '';
    },

    /**
     * Initialize rich text support on a contenteditable element
     * @param {HTMLElement} element - Element with contenteditable="true"
     * @param {Object} options - Options object
     */
    init(element, options = {}) {
        if (!element || element.dataset.richTextInit) return;

        element.dataset.richTextInit = 'true';

        // Ensure it's contenteditable
        if (!element.hasAttribute('contenteditable')) {
            element.setAttribute('contenteditable', 'true');
        }

        element.addEventListener('paste', (e) => RichText.handlePaste(e, element));
        element.addEventListener('keydown', (e) => RichText.handleKeydown(e, element));

        // Handle placeholder
        if (options.placeholder) {
            element.dataset.placeholder = options.placeholder;

            const updatePlaceholder = () => {
                if (!element.textContent.trim()) {
                    element.classList.add('rich-text-empty');
                } else {
                    element.classList.remove('rich-text-empty');
                }
            };

            element.addEventListener('input', updatePlaceholder);
            element.addEventListener('focus', updatePlaceholder);
            element.addEventListener('blur', updatePlaceholder);
            updatePlaceholder();
        }
    },

    /**
     * Initialize rich text on all elements matching a selector
     * @param {string} selector - CSS selector
     */
    initAll(selector) {
        document.querySelectorAll(selector).forEach(element => {
            RichText.init(element);
        });
    },

    /**
     * Convert a textarea to a contenteditable div
     * Preserves the textarea's value, id, and triggers
     * @param {HTMLTextAreaElement} textarea - Textarea to convert
     * @returns {HTMLElement} - The new contenteditable div
     */
    convertTextarea(textarea) {
        if (!textarea || textarea.tagName !== 'TEXTAREA') return null;

        const div = document.createElement('div');
        div.className = 'rich-text-editor';
        div.setAttribute('contenteditable', 'true');
        div.id = textarea.id;
        div.innerHTML = textarea.value || '';

        // Copy relevant attributes
        if (textarea.placeholder) {
            div.dataset.placeholder = textarea.placeholder;
        }

        // Style to match textarea
        div.style.minHeight = textarea.style.minHeight || '100px';
        div.style.padding = '0.75rem';
        div.style.border = '1px solid #dee2e6';
        div.style.borderRadius = '8px';
        div.style.backgroundColor = 'white';
        div.style.overflowY = 'auto';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';

        // Replace textarea with div
        textarea.parentNode.replaceChild(div, textarea);

        // Initialize rich text
        RichText.init(div);

        return div;
    },

    /**
     * Convert all textareas matching selector to contenteditable
     * @param {string} selector - CSS selector for textareas
     */
    convertAllTextareas(selector) {
        document.querySelectorAll(selector).forEach(textarea => {
            RichText.convertTextarea(textarea);
        });
    },

    /**
     * Sanitize HTML to prevent XSS attacks
     * Allows only safe tags and attributes
     * @param {string} html - HTML to sanitize
     * @returns {string} - Sanitized HTML
     */
    sanitizeHTML(html) {
        if (!html) return '';

        // Allowed tags (whitelist approach)
        const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'sup', 'sub'];

        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Recursively clean nodes
        function cleanNode(node) {
            const childNodes = Array.from(node.childNodes);

            for (const child of childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const tagName = child.tagName.toLowerCase();

                    // Remove disallowed tags but keep their text content
                    if (!allowedTags.includes(tagName)) {
                        // Move children out before removing
                        while (child.firstChild) {
                            node.insertBefore(child.firstChild, child);
                        }
                        node.removeChild(child);
                    } else {
                        // Clean attributes - only allow href on <a> tags
                        const attrs = Array.from(child.attributes);
                        for (const attr of attrs) {
                            if (tagName === 'a' && attr.name === 'href') {
                                // Validate href - only allow http/https
                                const href = attr.value.toLowerCase();
                                if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('/')) {
                                    child.removeAttribute('href');
                                } else {
                                    // Add safe attributes for links
                                    child.setAttribute('target', '_blank');
                                    child.setAttribute('rel', 'noopener noreferrer');
                                }
                            } else {
                                child.removeAttribute(attr.name);
                            }
                        }

                        // Recursively clean children
                        cleanNode(child);
                    }
                } else if (child.nodeType === Node.COMMENT_NODE) {
                    // Remove comments
                    node.removeChild(child);
                }
            }
        }

        cleanNode(temp);
        return temp.innerHTML;
    },

    // Legacy support - now works with both textareas and contenteditable
    // IMPORTANT: Always sanitizes HTML to prevent XSS
    toHTML(text) {
        if (!text) return '';
        // If already contains HTML, sanitize it
        if (/<[^>]+>/.test(text)) {
            return this.sanitizeHTML(text);
        }
        // Convert plain text to HTML (already safe)
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    },

    toMarkdown(html) {
        return this.cleanPastedHTML(html);
    }
};

// Add CSS for placeholder styling
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        .rich-text-editor:focus {
            outline: none;
            border-color: var(--teal, #20c997) !important;
            box-shadow: 0 0 0 2px rgba(32, 201, 151, 0.1);
        }
        .rich-text-editor.rich-text-empty:before {
            content: attr(data-placeholder);
            color: #9ca3af;
            pointer-events: none;
            position: absolute;
        }
        .rich-text-editor {
            position: relative;
        }
        .rich-text-editor a {
            color: var(--teal, #20c997);
            text-decoration: underline;
        }
        .rich-text-editor ul, .rich-text-editor ol {
            margin: 0.5rem 0;
            padding-left: 1.5rem;
        }
    `;
    document.head.appendChild(style);
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RichText;
}
