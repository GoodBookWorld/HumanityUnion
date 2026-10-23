/**
 * Integrity Media sends a calendar day, not a clock time.
 * A day that is today or earlier in UTC is due immediately, including before noon.
 * A later day stays at noon UTC so ordinary scheduling can hold it.
 * The returned instant never uses an earlier calendar day than the one supplied.
 */
export function integrityMediaArticlePublicationInstant(
  publicationDate: string,
  now: Date,
): string {
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const noon = `${publicationDate}T12:00:00.000Z`;
  if (publicationDate === today && noon > nowIso) {
    return nowIso;
  }
  return noon;
}
