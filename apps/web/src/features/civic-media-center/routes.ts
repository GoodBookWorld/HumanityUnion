/** Canonical public route for the Civic Media workspace. */
export const CIVIC_MEDIA_ROUTE = "/media";

export function civicMediaSectionHref(sectionId: string): string {
  return `${CIVIC_MEDIA_ROUTE}#${sectionId}`;
}
