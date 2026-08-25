/**
 * SEO Pack 07 — fetch public sparse page SEO overrides for metadata merge.
 */
import type { SeoPageOverrideFamily, SeoPageOverridePublicView } from "@hu/types";

import { apiRequestOptional } from "../api-client";

export async function fetchPublicSeoPageOverride(input: {
  family: SeoPageOverrideFamily;
  entityKey: string;
}): Promise<SeoPageOverridePublicView | null> {
  return apiRequestOptional<SeoPageOverridePublicView>(
    `/api/v1/public/seo/page-overrides/${encodeURIComponent(input.family)}/${encodeURIComponent(input.entityKey)}`,
  );
}
