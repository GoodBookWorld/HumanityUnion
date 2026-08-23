import { BLOG_PUBLICATION_DATE_MIN } from "@hu/types";

import { BlogValidationError } from "./blog.errors.js";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Pack 13C — calendar date → noon UTC ISO.
 * Avoids local-midnight day-shift between Author / Admin / public surfaces.
 */
export function publicationDateOnlyToIso(dateOnly: string): string {
  return `${dateOnly}T12:00:00.000Z`;
}

export function isoToPublicationDateOnly(iso: string | undefined): string | undefined {
  if (!iso) {
    return undefined;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1];
}

export function validatePublicationDateInput(
  value: unknown,
  options: { required?: boolean } = {},
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (options.required) {
      throw new BlogValidationError("publicationDate is required.");
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new BlogValidationError("publicationDate must be a YYYY-MM-DD date string.");
  }

  const trimmed = value.trim();
  const match = DATE_ONLY.exec(trimmed);
  if (!match) {
    throw new BlogValidationError("publicationDate must be a YYYY-MM-DD date string.");
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new BlogValidationError("publicationDate is not a valid calendar date.");
  }

  if (trimmed < BLOG_PUBLICATION_DATE_MIN) {
    throw new BlogValidationError(
      `publicationDate must be on or after ${BLOG_PUBLICATION_DATE_MIN}.`,
    );
  }

  return trimmed;
}

/** Compare publication Instant to "now" for schedule vs immediate publish. */
export function isPublicationDue(publishedAtIso: string, nowIso = new Date().toISOString()): boolean {
  return publishedAtIso <= nowIso;
}
