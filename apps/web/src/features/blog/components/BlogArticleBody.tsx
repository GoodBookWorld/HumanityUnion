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

export function BlogArticleBody({ html }: BlogArticleBodyProps) {
  return (
    <div
      className="blog-article-body hu-prose"
      // Server-sanitized Blog HTML from GET /api/v1/public/blog/:slug only.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
