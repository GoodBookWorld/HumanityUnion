import type {
  AchievementId,
  EvidenceId,
  ImplementationId,
} from "./identifiers.js";
import type { EvidenceAttachment } from "./evidence-attachment.js";
import type { EvidenceKind } from "./evidence-kind.js";
import type { EvidenceLink } from "./evidence-link.js";
import type { EvidenceReference } from "./evidence-reference.js";

/** Factual supporting material associated with an Achievement. */
export interface Evidence {
  evidenceId: EvidenceId;
  achievementId: AchievementId;
  implementationId: ImplementationId;
  evidenceKind: EvidenceKind;
  label: string;
  recordedAt: string;
  createdAt: string;
  reference: EvidenceReference | null;
  attachment: EvidenceAttachment | null;
  link: EvidenceLink | null;
}
