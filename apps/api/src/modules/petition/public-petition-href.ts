/**
 * HU-LC-05C.4C.7F.3 — canonical public URL of one published Petition: the
 * Initiative experience shell with the Petition selected. Stage-level links
 * that are not about a specific Petition keep the plain `#petition` anchor.
 */
export function buildPublicPetitionHref(initiativeId: string, petitionId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}?petition=${encodeURIComponent(petitionId)}#petition`;
}
