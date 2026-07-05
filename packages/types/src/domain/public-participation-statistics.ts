export type PublicGeographicScope = "world" | "country" | "region" | "community";

export interface ParticipationPublicStatisticsIndicator {
  id: string;
  label: string;
  value: number;
  derived: boolean;
}

export interface ParticipationPublicStatisticsProjection {
  scope: PublicGeographicScope;
  scopeLabel: string;
  indicators: ParticipationPublicStatisticsIndicator[];
  generatedAt: string;
  source: "bootstrap" | "projection";
}
