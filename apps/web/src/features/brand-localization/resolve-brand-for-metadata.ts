/**
 * Pack 08I.2 — server helper for metadata / structured data brand fields.
 */

import type { ResolvedLocalizedBrand } from "@hu/types";

import {
  getBuiltinEnglishBrand,
  resolveLocalizedBrandForLocale,
} from "./resolve-localized-brand";

export async function resolveBrandForMetadata(
  locale: string,
): Promise<ResolvedLocalizedBrand> {
  try {
    return await resolveLocalizedBrandForLocale(locale);
  } catch {
    return getBuiltinEnglishBrand(locale);
  }
}
