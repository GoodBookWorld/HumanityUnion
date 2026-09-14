/**
 * Production Completion Pack 02C Task 02 — document lang/dir is set on the
 * server-rendered `<html>` in `app/layout.tsx` via `resolveDocumentHtmlLocale`.
 *
 * This client component is intentionally a no-op so we do not re-derive lang/dir
 * after hydration (no English-then-switch flicker, no duplicate client locale state).
 */
export function DocumentLanguageAttributes() {
  return null;
}
