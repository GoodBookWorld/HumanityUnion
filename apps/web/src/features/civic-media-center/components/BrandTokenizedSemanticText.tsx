"use client";

import type { ElementType, ReactElement, ReactNode } from "react";

import { splitBrandTokenParts, templateHasBrandSiteNameToken } from "@hu/types";

import {
  MediaSemanticNode,
  type MediaSemanticResult,
} from "../../language/media-plp/media-semantic-contract";

/**
 * RESET 05C — render FAQ (or similar) templates with Brand-owned `{siteName}` spans.
 * Surrounding prose remains PLP_ENTITY; organization identity is BRAND.
 * Legacy snapshots without `{siteName}` stay a single PLP_ENTITY node.
 */
export function BrandTokenizedSemanticText(props: {
  readonly template: string;
  readonly siteName: string;
  readonly as?: "h3" | "p" | "span";
  readonly className?: string;
  readonly plpResult: MediaSemanticResult;
  readonly entityType: string;
  readonly entityId: string;
  readonly semanticPath: string;
}): ReactElement {
  const {
    template,
    siteName,
    as = "span",
    className,
    plpResult,
    entityType,
    entityId,
    semanticPath,
  } = props;

  if (!templateHasBrandSiteNameToken(template)) {
    return (
      <MediaSemanticNode
        as={as}
        className={className}
        owner="PLP_ENTITY"
        result={plpResult}
        entityType={entityType}
        entityId={entityId}
        semanticPath={semanticPath}
      >
        {template}
      </MediaSemanticNode>
    );
  }

  const parts = splitBrandTokenParts(template);
  const Wrapper = as as ElementType;
  const children: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part.kind === "brand") {
      children.push(
        <MediaSemanticNode
          key={`brand-${index}`}
          as="span"
          owner="BRAND"
          result="PUBLISHED_LOCALIZED"
          semanticPath={`${semanticPath}.siteName`}
        >
          {siteName}
        </MediaSemanticNode>,
      );
      return;
    }
    if (!part.text) {
      return;
    }
    children.push(
      <MediaSemanticNode
        key={`plp-${index}`}
        as="span"
        owner="PLP_ENTITY"
        result={plpResult}
        entityType={entityType}
        entityId={entityId}
        semanticPath={semanticPath}
      >
        {part.text}
      </MediaSemanticNode>,
    );
  });

  return <Wrapper className={className}>{children}</Wrapper>;
}
