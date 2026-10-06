/**
 * Admin-created Media Resources receive `media-resource-<uuid>`.
 * Catalog rows keep authored ids such as `ukrinform-ukraine`.
 */
const GENERATED_ADMIN_MEDIA_RESOURCE_ID =
  /^media-resource-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGeneratedAdminMediaResourceId(id: string): boolean {
  return GENERATED_ADMIN_MEDIA_RESOURCE_ID.test(id);
}

/** Secondary Name-column text. Null means render no metadata line. */
export function mediaResourceAdminIdSubtitle(id: string): string | null {
  return isGeneratedAdminMediaResourceId(id) ? null : id;
}
