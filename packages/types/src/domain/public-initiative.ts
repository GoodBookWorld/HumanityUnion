import type {
  InitiativeDescription,
  InitiativeId,
  InitiativeMetadata,
  InitiativeStatus,
  InitiativeTitle,
} from "./initiative.js";
import type { InitiativeNewsSourceReference } from "./public-news-article.js";

export interface PublicInitiativeProjection {
  initiativeId: InitiativeId;
  title: InitiativeTitle;
  description: InitiativeDescription;
  status: InitiativeStatus;
  metadata: InitiativeMetadata;
  stewardDisplayName: string;
  /** UX Evolution Pack 02.4 — present only for an active, publicly visible steward profile. */
  stewardProfileUrl?: string;
  createdAt: string;
  currentVersion: number;
  sourceReferences?: InitiativeNewsSourceReference[];
}
