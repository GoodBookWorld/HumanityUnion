import type { BlogCategoryId, LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, PRIORITY_LANGUAGE_CODES } from "@hu/types";

import { isBlogCategoryId } from "./blog-categories.js";
import { blogHtmlToPlainText, sanitizeBlogHtml } from "./blog-content-sanitize.js";
import { BlogValidationError } from "./blog.errors.js";
import { resolveBlogCoverMedia } from "./blog-cover-media.js";
import { normalizeBlogTags } from "./blog-tags.js";

const MAX_TITLE = 160;
const MAX_EXCERPT = 500;
const MAX_CONTENT_CHARS = 100_000;
const MIN_TITLE = 3;

export interface ValidatedBlogPostFields {
  title: string;
  excerpt: string;
  content: string;
  categoryId: BlogCategoryId;
  tags: string[];
  coverMedia: ReturnType<typeof resolveBlogCoverMedia>;
  originalLanguage: LanguageCode;
}

export function validateBlogTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new BlogValidationError("title is required.");
  }

  const title = value.trim().replace(/\s+/g, " ");
  if (title.length < MIN_TITLE) {
    throw new BlogValidationError(`title must be at least ${MIN_TITLE} characters.`);
  }
  if (title.length > MAX_TITLE) {
    throw new BlogValidationError(`title must be at most ${MAX_TITLE} characters.`);
  }
  return title;
}

export function validateBlogExcerpt(value: unknown, required: boolean): string {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new BlogValidationError("excerpt is required.");
    }
    return "";
  }

  if (typeof value !== "string") {
    throw new BlogValidationError("excerpt must be a string.");
  }

  const excerpt = value.trim().replace(/\s+/g, " ");
  if (excerpt.length > MAX_EXCERPT) {
    throw new BlogValidationError(`excerpt must be at most ${MAX_EXCERPT} characters.`);
  }
  return excerpt;
}

export function validateAndSanitizeBlogContent(value: unknown, required: boolean): string {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new BlogValidationError("content is required.");
    }
    return "";
  }

  if (typeof value !== "string") {
    throw new BlogValidationError("content must be a string.");
  }

  if (value.length > MAX_CONTENT_CHARS) {
    throw new BlogValidationError(`content exceeds ${MAX_CONTENT_CHARS} characters.`);
  }

  try {
    return sanitizeBlogHtml(value);
  } catch (error) {
    throw new BlogValidationError(
      error instanceof Error ? error.message : "Unsafe rich content was rejected.",
    );
  }
}

export function validateBlogCategoryId(value: unknown): BlogCategoryId {
  if (typeof value !== "string" || !isBlogCategoryId(value)) {
    throw new BlogValidationError(
      "categoryId must be one of: conscious_existence, human_security, our_life.",
    );
  }
  return value;
}

export function validateOriginalLanguage(value: unknown): LanguageCode {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PLATFORM_LANGUAGE;
  }

  if (typeof value !== "string") {
    throw new BlogValidationError("originalLanguage must be a language code.");
  }

  const code = value.trim().toLowerCase();
  if ((PRIORITY_LANGUAGE_CODES as readonly string[]).includes(code)) {
    return code as LanguageCode;
  }

  // Allow other BCP47-ish tags for migration compatibility.
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(code)) {
    return code;
  }

  throw new BlogValidationError("originalLanguage is not a valid language code.");
}

export function validateCreateBlogDraftInput(body: unknown): ValidatedBlogPostFields {
  if (!body || typeof body !== "object") {
    throw new BlogValidationError("Request body is required.");
  }

  const input = body as Record<string, unknown>;

  if ("authorParticipantId" in input) {
    throw new BlogValidationError("authorParticipantId cannot be client-supplied.");
  }

  const title = validateBlogTitle(input.title);
  const content = validateAndSanitizeBlogContent(input.content, false);
  const excerpt =
    validateBlogExcerpt(input.excerpt, false) ||
    blogHtmlToPlainText(content).slice(0, MAX_EXCERPT) ||
    title;

  return {
    title,
    excerpt,
    content,
    categoryId: validateBlogCategoryId(input.categoryId),
    tags: normalizeBlogTags(input.tags),
    coverMedia: resolveBlogCoverMedia(input.coverMedia),
    originalLanguage: validateOriginalLanguage(input.originalLanguage),
  };
}

export function validateUpdateBlogDraftInput(body: unknown): Partial<ValidatedBlogPostFields> {
  if (!body || typeof body !== "object") {
    throw new BlogValidationError("Request body is required.");
  }

  const input = body as Record<string, unknown>;

  if ("authorParticipantId" in input) {
    throw new BlogValidationError("authorParticipantId cannot be client-supplied.");
  }

  const patch: Partial<ValidatedBlogPostFields> = {};

  if ("title" in input) {
    patch.title = validateBlogTitle(input.title);
  }
  if ("excerpt" in input) {
    patch.excerpt = validateBlogExcerpt(input.excerpt, false);
  }
  if ("content" in input) {
    patch.content = validateAndSanitizeBlogContent(input.content, false);
  }
  if ("categoryId" in input) {
    patch.categoryId = validateBlogCategoryId(input.categoryId);
  }
  if ("tags" in input) {
    patch.tags = normalizeBlogTags(input.tags);
  }
  if ("coverMedia" in input) {
    patch.coverMedia = resolveBlogCoverMedia(input.coverMedia);
  }
  if ("originalLanguage" in input) {
    patch.originalLanguage = validateOriginalLanguage(input.originalLanguage);
  }

  if (Object.keys(patch).length === 0) {
    throw new BlogValidationError("No updatable Blog fields provided.");
  }

  return patch;
}

export function requirePublishableContent(fields: {
  title: string;
  excerpt: string;
  content: string;
}): void {
  if (!fields.title.trim()) {
    throw new BlogValidationError("title is required to publish.");
  }
  if (!fields.excerpt.trim()) {
    throw new BlogValidationError("excerpt is required to publish.");
  }
  if (!fields.content.trim() || !blogHtmlToPlainText(fields.content)) {
    throw new BlogValidationError("content is required to publish.");
  }
}

const MAX_APPLICATION_TEXT = 2_000;
const MAX_PREVIOUS_WRITING_URL = 500;

export interface ValidatedBlogAuthorApplicationFields {
  motivation: string;
  topics: string;
  previousWritingUrl?: string;
  preferredCategoryIds: BlogCategoryId[];
  agreedToStandards: true;
}

function validateApplicationText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new BlogValidationError(`${fieldName} is required.`);
  }

  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 10) {
    throw new BlogValidationError(`${fieldName} must be at least 10 characters.`);
  }
  if (text.length > MAX_APPLICATION_TEXT) {
    throw new BlogValidationError(`${fieldName} must be at most ${MAX_APPLICATION_TEXT} characters.`);
  }
  return text;
}

export function validateBlogAuthorApplicationInput(
  input: Record<string, unknown>,
): ValidatedBlogAuthorApplicationFields {
  const motivation = validateApplicationText(input.motivation ?? input.note, "motivation");
  const topics = validateApplicationText(input.topics, "topics");

  let previousWritingUrl: string | undefined;
  if (input.previousWritingUrl !== undefined && input.previousWritingUrl !== null && input.previousWritingUrl !== "") {
    if (typeof input.previousWritingUrl !== "string") {
      throw new BlogValidationError("previousWritingUrl must be a string.");
    }
    const trimmed = input.previousWritingUrl.trim();
    if (trimmed.length > MAX_PREVIOUS_WRITING_URL) {
      throw new BlogValidationError(
        `previousWritingUrl must be at most ${MAX_PREVIOUS_WRITING_URL} characters.`,
      );
    }
    previousWritingUrl = trimmed || undefined;
  }

  if (!Array.isArray(input.preferredCategoryIds) || input.preferredCategoryIds.length === 0) {
    throw new BlogValidationError("Select at least one preferred Blog category.");
  }

  const preferredCategoryIds: BlogCategoryId[] = [];
  for (const raw of input.preferredCategoryIds) {
    if (typeof raw !== "string" || !isBlogCategoryId(raw)) {
      throw new BlogValidationError("preferredCategoryIds contains an invalid category.");
    }
    if (!preferredCategoryIds.includes(raw)) {
      preferredCategoryIds.push(raw);
    }
  }

  if (input.agreedToStandards !== true) {
    throw new BlogValidationError(
      "You must agree that publications will follow platform Safety and publishing standards.",
    );
  }

  return {
    motivation,
    topics,
    previousWritingUrl,
    preferredCategoryIds,
    agreedToStandards: true,
  };
}
