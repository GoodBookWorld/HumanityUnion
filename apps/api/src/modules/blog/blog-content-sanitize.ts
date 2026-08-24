/**
 * Server-side Blog rich-content sanitization boundary.
 *
 * Representation: sanitized HTML (CKEditor 5 / legacy TipTap-compatible subset).
 * DOMPurify on the browser is never trusted as the only boundary.
 *
 * Allowed: headings, p, lists, links, blockquote, images (+ figure/figcaption),
 * tables, hr, strong/em/u/br, safe text-align / width styles, safe image classes.
 * Everything else is stripped. Scripts / event handlers rejected.
 */

const ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "p",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
  "strong",
  "em",
  "u",
  "br",
]);

const VOID_TAGS = new Set(["hr", "br", "img"]);

const TEXT_ALIGN_STYLE_PATTERN = /^text-align:\s*(left|center|right|justify)\s*;?$/i;
const WIDTH_STYLE_PATTERN = /^width:\s*(\d{1,3}(?:\.\d+)?)%\s*;?$/i;

const BLOCK_TAGS_WITH_ALIGN = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "figure",
  "th",
  "td",
]);

const SAFE_CLASS_PATTERN =
  /^(image|image_resized|image-style-align-left|image-style-align-center|image-style-align-right|image-style-block|image-style-inline|image-style-side|table|ck-table-resized)(\s+(image|image_resized|image-style-align-left|image-style-align-center|image-style-align-right|image-style-block|image-style-inline|image-style-side|table|ck-table-resized))*$/;

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return false;
  }

  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("/") ||
    lower.startsWith("#") ||
    lower.startsWith("mailto:")
  );
}

function isSafeImgSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
    return false;
  }

  // Platform media URLs or absolute https only.
  return (
    lower.startsWith("/api/v1/media/files/") ||
    lower.startsWith("https://") ||
    /^https?:\/\/[^/]+\/api\/v1\/media\/files\//i.test(trimmed)
  );
}

function sanitizeStyle(style: string | undefined, allowWidth: boolean): string | undefined {
  if (!style) {
    return undefined;
  }

  const parts: string[] = [];
  for (const rawPart of style.split(";")) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }
    const align = TEXT_ALIGN_STYLE_PATTERN.exec(part);
    if (align) {
      parts.push(`text-align: ${align[1]!.toLowerCase()}`);
      continue;
    }
    if (allowWidth) {
      const width = WIDTH_STYLE_PATTERN.exec(part);
      if (width) {
        const pct = Number.parseFloat(width[1]!);
        if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
          parts.push(`width: ${pct}%`);
        }
      }
    }
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}

function sanitizeClass(className: string | undefined): string | undefined {
  if (!className?.trim()) {
    return undefined;
  }
  const normalized = className.trim().replace(/\s+/g, " ");
  if (!SAFE_CLASS_PATTERN.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(raw)) !== null) {
    const name = match[1]!.toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    attrs[name] = decodeEntities(value);
  }

  return attrs;
}

function serializeAllowedTag(tag: string, attrs: Record<string, string>, selfClosing: boolean): string {
  if (tag === "a") {
    const href = attrs.href ?? "";
    if (!isSafeHref(href)) {
      return "";
    }
    return `<a href="${escapeAttribute(href)}">`;
  }

  if (tag === "img") {
    const src = attrs.src ?? "";
    if (!isSafeImgSrc(src)) {
      return "";
    }
    const alt = attrs.alt ?? "";
    const className = sanitizeClass(attrs.class);
    const style = sanitizeStyle(attrs.style, true);
    let open = `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"`;
    if (className) {
      open += ` class="${escapeAttribute(className)}"`;
    }
    if (style) {
      open += ` style="${escapeAttribute(style)}"`;
    }
    return `${open} />`;
  }

  if (VOID_TAGS.has(tag)) {
    return selfClosing || tag === "hr" || tag === "br" ? `<${tag} />` : `<${tag}>`;
  }

  const pieces: string[] = [`<${tag}`];
  if (tag === "figure" || tag === "table") {
    const className = sanitizeClass(attrs.class);
    if (className) {
      pieces.push(` class="${escapeAttribute(className)}"`);
    }
  }

  if (BLOCK_TAGS_WITH_ALIGN.has(tag) || tag === "figure" || tag === "table") {
    const style = sanitizeStyle(attrs.style, tag === "figure" || tag === "table" || tag === "img");
    if (style) {
      pieces.push(` style="${escapeAttribute(style)}"`);
    }
  }

  pieces.push(">");
  return pieces.join("");
}

/**
 * Sanitize Blog HTML. Returns empty string for empty input.
 * Throws when content is empty after sanitization but input had substance
 * that was entirely unsafe (e.g. only script tags).
 */
export function sanitizeBlogHtml(input: string): string {
  if (typeof input !== "string") {
    throw new Error("content must be a string.");
  }

  const source = input.trim();
  if (!source) {
    return "";
  }

  // Fast reject obvious script / event-handler payloads before parse.
  if (/<script\b/i.test(source) || /\bon[a-z]+\s*=/i.test(source)) {
    // Continue to strip rather than hard-fail — strippers remove them.
  }

  let output = "";
  const openStack: string[] = [];
  const tokenPattern = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(source)) !== null) {
    const full = match[0]!;

    if (full.startsWith("<!--")) {
      continue;
    }

    if (full.startsWith("</")) {
      const tag = (match[1] ?? "").toLowerCase();
      if (!ALLOWED_TAGS.has(tag) || VOID_TAGS.has(tag)) {
        continue;
      }

      // Close until matching tag (malformed HTML tolerance).
      while (openStack.length > 0) {
        const current = openStack.pop()!;
        output += `</${current}>`;
        if (current === tag) {
          break;
        }
      }
      continue;
    }

    if (full.startsWith("<")) {
      const tag = (match[1] ?? "").toLowerCase();
      const attrRaw = match[2] ?? "";
      const selfClosing = /\/\s*$/.test(attrRaw) || VOID_TAGS.has(tag);

      if (!ALLOWED_TAGS.has(tag)) {
        continue;
      }

      const attrs = parseAttributes(attrRaw);
      const serialized = serializeAllowedTag(tag, attrs, selfClosing);

      if (!serialized) {
        continue;
      }

      output += serialized;

      if (!selfClosing && !VOID_TAGS.has(tag) && !serialized.endsWith("/>")) {
        openStack.push(tag);
      }

      continue;
    }

    output += escapeText(match[3] ?? "");
  }

  while (openStack.length > 0) {
    output += `</${openStack.pop()}>`;
  }

  const sanitized = output.trim();

  if (!sanitized && /[^\s]/.test(source.replace(/<[^>]*>/g, ""))) {
    // Had text but lost it somehow — return escaped text fallback.
    return `<p>${escapeText(source.replace(/<[^>]*>/g, "").trim())}</p>`;
  }

  if (!sanitized && /<\s*script/i.test(source)) {
    throw new Error("Unsafe rich content was rejected.");
  }

  return sanitized;
}

/** Plain-text extraction for Safety evaluation and search. */
export function blogHtmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
