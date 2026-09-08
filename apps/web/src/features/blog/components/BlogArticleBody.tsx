/**
 * Trust boundary (Pack 03):
 * Renders only the canonical public Blog content string, which the API has already
 * sanitized server-side. Never inject client-authored HTML. No scripts, iframes,
 * event handlers, or arbitrary inline styles are introduced here — platform CSS
 * styles the allowed TipTap-compatible subset.
 */

interface BlogArticleBodyProps {
  html: string;
}

/**
 * Presentation-only: remove empty `<p>` nodes whose sole content is non-breaking
 * space entities (including double-escaped `&amp;nbsp;` that would otherwise
 * appear as the literal text `&nbsp;`). Does not mutate stored/canonical content
 * and does not rewrite nbsp inside meaningful text.
 */
export function normalizeBlogArticleHtmlForDisplay(html: string): string {
  return html.replace(
    /<p(\s[^>]*)?>\s*(?:(?:&amp;nbsp;|&nbsp;|&#160;|&#x0*a0;|\u00a0|\s)+)\s*<\/p>/gi,
    "",
  );
}

export function BlogArticleBody({ html }: BlogArticleBodyProps) {
  const displayHtml = normalizeBlogArticleHtmlForDisplay(html);

  return (
    <div
      className="blog-article-body hu-prose"
      // Server-sanitized Blog HTML from GET /api/v1/public/blog/:slug only.
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  );
}
