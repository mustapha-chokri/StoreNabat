import sanitizeHtml from 'sanitize-html';

/**
 * Sanitizes custom HTML blocks (Thank You Page / Custom Homepage Content)
 * preventing XSS scripts, event handlers, or dangerous URLs.
 */
export function sanitizeRichHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) return '';
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'div',
      'span',
      'blockquote',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'width', 'height', 'class'],
      div: ['class', 'dir'],
      span: ['class'],
      p: ['class', 'dir'],
      h1: ['class'],
      h2: ['class'],
      h3: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
  });
}

/**
 * Sanitizes store custom CSS to prevent CSS-based injection attacks
 * (`expression()`, `@import`, `javascript:`, `<style>` tag escapes).
 */
export function sanitizeCustomCss(rawCss: string | null | undefined): string {
  if (!rawCss) return '';
  const stripped = rawCss
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]*;?/gi, '')
    .replace(/-moz-binding\s*:[^;]*;?/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:[^)]*\)/gi, '')
    .replace(/url\s*\(\s*['"]?\s*data:text\/html[^)]*\)/gi, '');

  return stripped.slice(0, 20_000);
}

