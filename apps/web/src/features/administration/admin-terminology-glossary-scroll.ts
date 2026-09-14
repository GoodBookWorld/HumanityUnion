/**
 * Pack 02F staging-smoke UX — glossary editor scroll behavior.
 */

export function resolveGlossaryEditorScrollBehavior(
  prefersReducedMotion: boolean,
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}
