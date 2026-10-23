/**
 * Integrity Media sends a calendar day, not a schedule instruction.
 * Today and earlier stay on that calendar day and are already due.
 * A later day is not a schedule: the ingest instant is used so the post is due now.
 * Ordinary Blog posts do not use this helper.
 */
export function integrityMediaArticlePublicationInstant(
  publicationDate: string,
  now: Date,
): string {
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  if (publicationDate > today) {
    return nowIso;
  }
  const noon = `${publicationDate}T12:00:00.000Z`;
  if (publicationDate === today && noon > nowIso) {
    return nowIso;
  }
  return noon;
}
