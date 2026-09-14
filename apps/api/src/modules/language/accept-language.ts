/**
 * Production Completion Pack 02C — Accept-Language helpers.
 * Canonical implementation lives in `@hu/types` (shared with Web SSR).
 */

export type { AcceptLanguagePreference } from "@hu/types";
export {
  expandLocaleLookupCandidates,
  listAcceptLanguageLookupTags,
  parseAcceptLanguageHeader,
} from "@hu/types";
