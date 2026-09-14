/**
 * Pack 08K — dev/test guard for Public Localization Boundary.
 *
 * In test/dev (NODE_ENV !== production OR HU_ASSERT_PUBLIC_LOCALIZATION=1),
 * throws when a governed surface fails to pass a presentation, or when
 * requireComplete is set and coverage is not COMPLETE / SOURCE_LANGUAGE / MANUAL.
 */

import type { PublicLocalizedPresentation } from "@hu/types";

function assertionsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.HU_ASSERT_PUBLIC_LOCALIZATION === "1"
  );
}

export function assertPublicLocalizationBoundary(input: {
  surfaceId: string;
  presentation: PublicLocalizedPresentation | null | undefined;
  /** If true, raw canonical semantic render is forbidden */
  requireComplete?: boolean;
}): void {
  if (!assertionsEnabled()) {
    return;
  }

  if (input.presentation == null) {
    throw new Error(
      `PUBLIC_LOCALIZATION_BOUNDARY: missing presentation for surface "${input.surfaceId}"`,
    );
  }

  if (!input.requireComplete) {
    return;
  }

  const status = input.presentation.coverage.status;
  if (status !== "COMPLETE" && status !== "SOURCE_LANGUAGE" && status !== "MANUAL") {
    throw new Error(
      `PUBLIC_LOCALIZATION_BOUNDARY: surface "${input.surfaceId}" requireComplete but coverage.status=${status}`,
    );
  }
}
