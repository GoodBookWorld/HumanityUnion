/**
 * HU-LEGAL-EDITOR-01B — Server-side Legal Localization HTML sanitization.
 *
 * Trust boundary for counsel-approved Privacy/Terms localized bodies.
 * DOMPurify (or any browser-only filter) is never the only boundary.
 *
 * Allowed: section, h2, h3, p, ul, ol, li, a, strong, em, u, br.
 * Links: http(s), absolute path, hash, mailto only.
 * Strips scripts, event handlers, styles, classes, images, tables, embeds.
 *
 * Visible wording is preserved when unknown tags wrap text (unwrap).
 * Script/style/iframe/object/embed/noscript inner content is discarded.
 */

const ALLOWED_TAGS = new Set([
  "section",
  "h2",
  "h3",
  "p",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "em",
  "u",
  "br",
  // CKEditor / legacy aliases — normalized to strong/em on serialize.
  "b",
  "i",
]);

/** Canonical tag emitted for each allowed input tag. */
const OUTPUT_TAG: Record<string, string> = {
  section: "section",
  h2: "h2",
  h3: "h3",
  p: "p",
  ul: "ul",
  ol: "ol",
  li: "li",
  a: "a",
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
  u: "u",
  br: "br",
};

const VOID_TAGS = new Set(["br"]);

/** Tags whose entire subtree is discarded (not unwrapped). */
const DROP_SUBTREE_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "svg",
  "math",
  "template",
  "link",
  "meta",
  "base",
]);

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

/**
 * Normalize NBSP artifacts before sanitize/escape (CKEditor empty paragraphs).
 * Same contract as Blog — prevents visible "&nbsp;" after round-trip.
 */
export function normalizeLegalNbspArtifacts(html: string): string {
  return html
    .replace(/\u00A0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&amp;#160;/gi, " ")
    .replace(/&amp;#x0*a0;/gi, " ");
}

function collapseWhitespaceOnlyParagraphs(html: string): string {
  return html.replace(/<p(\s[^>]*)?>\s+<\/p>/gi, "<p$1></p>");
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

export function isSafeLegalHref(href: string): boolean {
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

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(raw)) !== null) {
    const name = match[1]!.toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    attrs[name] = decodeEntities(value);
  }

  return attrs;
}

function serializeAllowedTag(
  tag: string,
  attrs: Record<string, string>,
  selfClosing: boolean,
): string {
  const outTag = OUTPUT_TAG[tag] ?? tag;

  if (outTag === "a") {
    const href = attrs.href ?? "";
    if (!isSafeLegalHref(href)) {
      return "";
    }
    return `<a href="${escapeAttribute(href)}">`;
  }

  if (VOID_TAGS.has(outTag)) {
    return selfClosing || outTag === "br" ? `<${outTag} />` : `<${outTag}>`;
  }

  // No style / class / id / event attributes on legal markup.
  return `<${outTag}>`;
}

/**
 * Visible plain text for preservation checks (whitespace-collapsed).
 * Does not execute or interpret markup beyond stripping tags.
 */
export function legalHtmlToPlainText(html: string): string {
  return normalizeLegalNbspArtifacts(html)
    .replace(/<(script|style|iframe|object|embed|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export type LegalHtmlSanitizeResult = {
  readonly html: string;
  /** True when visible wording is unchanged (whitespace-normalized). */
  readonly preservedVisibleText: boolean;
  readonly inputPlainText: string;
  readonly outputPlainText: string;
};

/**
 * Detailed sanitize for write/public boundaries.
 * Never mutates Mongo by itself — callers decide persistence.
 */
export function sanitizeLegalHtmlDetailed(input: string): LegalHtmlSanitizeResult {
  if (typeof input !== "string") {
    throw new Error("localizedBody must be a string.");
  }

  const source = normalizeLegalNbspArtifacts(input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim());
  const inputPlainText = legalHtmlToPlainText(source);

  if (!source) {
    return {
      html: "",
      preservedVisibleText: true,
      inputPlainText: "",
      outputPlainText: "",
    };
  }

  let output = "";
  const openStack: string[] = [];
  let dropDepth = 0;
  const tokenPattern = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(source)) !== null) {
    const full = match[0]!;

    if (full.startsWith("<!--")) {
      continue;
    }

    if (full.startsWith("</")) {
      const tag = (match[1] ?? "").toLowerCase();
      if (DROP_SUBTREE_TAGS.has(tag)) {
        if (dropDepth > 0) {
          dropDepth -= 1;
        }
        continue;
      }
      if (dropDepth > 0) {
        continue;
      }
      if (!ALLOWED_TAGS.has(tag) || VOID_TAGS.has(tag)) {
        continue;
      }

      const closeTag = OUTPUT_TAG[tag] ?? tag;
      while (openStack.length > 0) {
        const current = openStack.pop()!;
        output += `</${current}>`;
        if (current === closeTag) {
          break;
        }
      }
      continue;
    }

    if (full.startsWith("<")) {
      const tag = (match[1] ?? "").toLowerCase();
      const attrRaw = match[2] ?? "";
      const selfClosing = /\/\s*$/.test(attrRaw) || VOID_TAGS.has(tag);

      if (DROP_SUBTREE_TAGS.has(tag)) {
        if (!selfClosing) {
          dropDepth += 1;
        }
        continue;
      }

      if (dropDepth > 0) {
        continue;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap: skip tag, keep descendant text.
        continue;
      }

      const attrs = parseAttributes(attrRaw);
      const serialized = serializeAllowedTag(tag, attrs, selfClosing);

      if (!serialized) {
        // e.g. unsafe <a> — keep link text via unwrap.
        continue;
      }

      output += serialized;

      if (!selfClosing && !VOID_TAGS.has(tag) && !serialized.endsWith("/>")) {
        openStack.push(OUTPUT_TAG[tag] ?? tag);
      }

      continue;
    }

    if (dropDepth > 0) {
      continue;
    }

    output += escapeText(match[3] ?? "");
  }

  while (openStack.length > 0) {
    output += `</${openStack.pop()}>`;
  }

  let sanitized = collapseWhitespaceOnlyParagraphs(output.trim());

  if (!sanitized && inputPlainText) {
    // Had visible text but lost structure — preserve wording as a paragraph.
    sanitized = `<p>${escapeText(inputPlainText)}</p>`;
  }

  const outputPlainText = legalHtmlToPlainText(sanitized);
  const preservedVisibleText = inputPlainText === outputPlainText;

  return {
    html: sanitized,
    preservedVisibleText,
    inputPlainText,
    outputPlainText,
  };
}

/** Sanitize and return HTML string (admin preview / simple callers). */
export function sanitizeLegalHtml(input: string): string {
  return sanitizeLegalHtmlDetailed(input).html;
}

/**
 * Sanitize for public render. Always returns safe HTML string.
 * Prefer wording preservation via unwrap / text fallback.
 */
export function sanitizeLegalHtmlForPublic(input: string): string {
  return sanitizeLegalHtmlDetailed(input).html;
}

/**
 * Sanitize for admin write. Rejects when visible legal wording would change
 * (beyond whitespace / entity normalization) so counsel text is never silently altered.
 */
export function sanitizeLegalHtmlForWrite(input: string): string {
  const result = sanitizeLegalHtmlDetailed(input);
  if (!result.preservedVisibleText && result.inputPlainText) {
    throw new Error(
      "localizedBody sanitization would change visible legal wording. " +
        "Remove unsupported markup manually or adjust content so wording is preserved.",
    );
  }
  return result.html;
}
