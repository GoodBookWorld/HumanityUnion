import type { ReactNode } from "react";

/**
 * Browser Google Translate convenience compatibility (not the source of truth).
 *
 * Language Architecture Pack 01: canonical translations live in the
 * TranslationProvider / TranslatedContentRecord model. Browser Google Translate
 * may remain as an optional convenience layer for ordinary text nodes.
 *
 * Why browser Translate misses some generated form values (confirmed in code):
 * - Google Translate intentionally skips `<input>` / `<textarea>` values.
 * - Lifecycle Author editors bind React controlled state (`value={...}`),
 *   including AI-generated drafts applied into form state — those values never
 *   become translate-eligible text nodes while editing.
 * - Public / Preview surfaces render the same copy as ordinary text nodes with
 *   `translate="yes"` so browser Translate can rewrite them for convenience.
 *
 * Do not depend on DOM mutation for platform data architecture.
 * Author drafts must use explicit “Translate Draft” assistance — never silent
 * replacement of controlled form values.
 */
export function LifecycleTranslatableText({
  children,
  as: Tag = "p",
  className,
}: {
  readonly children: ReactNode;
  readonly as?: "p" | "div" | "span";
  readonly className?: string;
}) {
  return (
    <Tag className={className} translate="yes">
      {children}
    </Tag>
  );
}
