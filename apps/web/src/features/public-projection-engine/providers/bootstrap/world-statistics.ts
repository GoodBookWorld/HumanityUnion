import type { ParticipationPublicStatisticsProjection } from "@hu/types";

export const WORLD_PARTICIPATION_PUBLIC_STATISTICS_PROJECTION: ParticipationPublicStatisticsProjection =
  {
    scope: "world",
    scopeLabel: "World",
    source: "bootstrap",
    generatedAt: "2026-01-01T00:00:00.000Z",
    indicators: [
      {
        id: "public-initiatives",
        label: "Public initiatives visible",
        value: 3,
        derived: false,
      },
      {
        id: "active-participation-paths",
        label: "Active participation paths",
        value: 2,
        derived: true,
      },
      {
        id: "public-records",
        label: "Public civic records",
        value: 8,
        derived: true,
      },
    ],
  };
