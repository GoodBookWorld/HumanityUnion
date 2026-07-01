import type {
  InitiativeDescription,
  InitiativeId,
  InitiativeMetadata,
  InitiativeStatus,
  InitiativeTitle,
} from "./initiative.js";

export interface PublicInitiativeProjection {
  initiativeId: InitiativeId;
  title: InitiativeTitle;
  description: InitiativeDescription;
  status: InitiativeStatus;
  metadata: InitiativeMetadata;
  stewardDisplayName: string;
  createdAt: string;
}
