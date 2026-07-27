export interface WorldInitiativeCardProjection {
  initiativeId: string;
  title: string;
  summary: string;
  activityArea: string;
  geographyLabel: string;
  imageUrl?: string;
  startDate?: string;
  completionDate?: string;
  publicStatus: string;
  currentStageLabel?: string;
  publicInitiativeHref: string;
  publishedAt: string;
  supportSummary?: {
    likes: number;
    dislikes: number;
  };
}

export interface WorldInitiativesPublicProjection {
  scope: "world";
  scopeLabel: string;
  source: "projection";
  generatedAt: string;
  initiatives: WorldInitiativeCardProjection[];
}
