/**
 * Soft locale-transition navigation for SEO-prefixed public routes.
 *
 * Implementation 03 — URL change alone is not enough: Server Component
 * locale-scoped payloads (e.g. Media PLP maps) must be refreshed so soft
 * navigation matches a hard load of the target locale route.
 *
 * Pure / injectable — no React imports (testable).
 */

export type LocaleSwitchRouter = {
  replace: (href: string) => void;
  refresh: () => void;
};

/**
 * Schedule locale-switch navigation.
 *
 * - When `href` differs from the current pathname: replace to the new
 *   locale-prefixed route, then refresh so RSC re-composes for that locale.
 * - When `href` is null/same: refresh only (cookie + same-document locale).
 */
export function runLocaleSwitchNavigation(input: {
  readonly router: LocaleSwitchRouter;
  readonly pathname: string;
  readonly href: string | null;
}): {
  readonly didReplace: boolean;
  readonly didRefresh: boolean;
} {
  const href = typeof input.href === "string" ? input.href.trim() : "";
  if (href.length > 0 && href !== input.pathname) {
    input.router.replace(href);
    input.router.refresh();
    return { didReplace: true, didRefresh: true };
  }
  input.router.refresh();
  return { didReplace: false, didRefresh: true };
}
