/**
 * Implementation 03 — Media soft-locale transition: SSR PLP batch alignment.
 *
 * When soft navigation updates the document locale before Server Component
 * props refresh, previous-locale PLP maps must not remain authoritative.
 */

import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

/**
 * True when stamped SSR batch locale is absent (legacy) or equals requested locale.
 * False when batch is present and differs — drop maps until RSC refresh.
 */
export function mediaSsrPlpAlignedWithRequestedLocale(input: {
  readonly batchLocale: string | null | undefined;
  readonly requestedLocale: string | null | undefined;
}): boolean {
  const requested = normalizeLanguageRegistryLocaleKey(
    typeof input.requestedLocale === "string" ? input.requestedLocale : "",
  );
  if (!requested) {
    return false;
  }
  const batch = normalizeLanguageRegistryLocaleKey(
    typeof input.batchLocale === "string" ? input.batchLocale : "",
  );
  if (!batch) {
    return true;
  }
  return batch === requested;
}
