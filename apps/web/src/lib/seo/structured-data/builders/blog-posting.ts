import { absoluteStructuredDataUrl, resolveStructuredDataOrigin } from "../absolute-url";
import { assertRequiredJsonLdFields } from "../serialize-json-ld";
import type { BlogPostingJsonLdInput, JsonLdNode } from "../types";
import { buildBreadcrumbListJsonLd } from "./breadcrumb-list";
import { buildPublisherReference } from "./organization-website";

export function buildBlogPostingJsonLd(
  input: BlogPostingJsonLdInput,
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode[] | null {
  if (!origin) {
    return null;
  }

  const url = absoluteStructuredDataUrl(input.canonicalPath, origin);
  if (!url || !input.headline.trim() || !input.author.name.trim()) {
    return null;
  }

  const author: JsonLdNode = {
    "@type": "Person",
    name: input.author.name.trim(),
  };

  if (input.author.profilePathOrUrl?.trim()) {
    const authorUrl = absoluteStructuredDataUrl(input.author.profilePathOrUrl.trim(), origin);
    if (authorUrl) {
      author.url = authorUrl;
    }
  }

  if (input.author.avatarUrl?.trim()) {
    const avatar = absoluteStructuredDataUrl(input.author.avatarUrl.trim(), origin);
    if (avatar) {
      author.image = avatar;
    }
  }

  const node: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline.trim(),
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    author,
  };

  const description = input.description?.trim();
  if (description) {
    node.description = description;
  }

  if (input.imageUrl?.trim()) {
    const image = absoluteStructuredDataUrl(input.imageUrl.trim(), origin);
    if (image) {
      node.image = image;
    }
  }

  if (input.datePublished?.trim()) {
    node.datePublished = input.datePublished.trim();
  }

  if (input.dateModified?.trim()) {
    node.dateModified = input.dateModified.trim();
  }

  const publisher = buildPublisherReference(origin);
  if (publisher) {
    node.publisher = publisher;
  }

  assertRequiredJsonLdFields(node, ["@type", "headline", "url", "author"]);

  const nodes: JsonLdNode[] = [node];
  const breadcrumbs = buildBreadcrumbListJsonLd(
    [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: input.headline.trim(), path: input.canonicalPath },
    ],
    origin,
  );
  if (breadcrumbs) {
    nodes.push(breadcrumbs);
  }

  return nodes;
}
