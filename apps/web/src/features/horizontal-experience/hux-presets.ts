import type {
  HorizontalRailLayout,
  HorizontalSurfaceStyle,
} from "../civic-media-center/media-rail/horizontal-section.types";

import type { HuxExperienceVariant } from "./hux.types";

export interface HuxExperiencePreset {
  surfaceStyle: HorizontalSurfaceStyle;
  layout: HorizontalRailLayout;
  showCount: boolean;
  hideSummary: boolean;
  showScrollHint: boolean;
}

export const HUX_EXPERIENCE_PRESETS: Record<HuxExperienceVariant, HuxExperiencePreset> = {
  discovery: {
    surfaceStyle: "plain",
    layout: "three-two-one",
    showCount: true,
    hideSummary: false,
    showScrollHint: false,
  },
  directory: {
    surfaceStyle: "grouped",
    layout: "four-two-one",
    showCount: false,
    hideSummary: true,
    showScrollHint: false,
  },
  workflow: {
    surfaceStyle: "elevated",
    layout: "four-two-one",
    showCount: false,
    hideSummary: true,
    showScrollHint: false,
  },
  education: {
    surfaceStyle: "plain",
    layout: "four-two-one",
    showCount: true,
    hideSummary: false,
    showScrollHint: false,
  },
};

export function resolveHuxPreset(
  experience: HuxExperienceVariant,
  overrides?: Partial<HuxExperiencePreset>,
): HuxExperiencePreset {
  return { ...HUX_EXPERIENCE_PRESETS[experience], ...overrides };
}
