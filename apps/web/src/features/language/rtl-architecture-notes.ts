/**
 * RTL architecture blockers / preparation notes (Language Packs 01–02 / Pack 02C).
 *
 * Priority RTL languages: Arabic (ar), Hebrew (he).
 *
 * Ready (Pack 02C Task 02):
 * - Root document `lang` / `dir` from Registry-backed `resolveDocumentHtmlLocale`
 *   on the server (`app/layout.tsx`) before paint — no client useEffect flicker
 * - `ResolvedRuntimeLocale.textDirection` from Language Registry (e.g. `ar` → rtl)
 * - Preferences Language & Translation controls use text labels (not flags)
 *
 * Remaining blockers before full RTL rollout (do not redesign entire platform here):
 * - Many layouts still use physical CSS (margin-left/right, left/right) instead of
 *   logical properties (margin-inline, padding-inline, inset-inline)
 * - Workspace sidebars, rails, and sticky Assistant FAB assume LTR edge placement
 * - Some absolute-positioned overlays and icon-only controls lack mirrored layouts
 * - Public Initiative / Analysis / Petition page chrome not fully audited for
 *   mirrored grids, breadcrumbs, or action clusters
 * - Translate Draft / Preferences selects inherit platform LTR form chrome
 *
 * Pack 03+ / 02J should migrate high-traffic shells to logical CSS incrementally.
 */

export const RTL_ARCHITECTURE_STATUS = {
  helpersReady: true,
  rootDirPreferenceDriven: true,
  logicalCssMigrationComplete: false,
} as const;
