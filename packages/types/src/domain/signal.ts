import type { MemberId } from "./member.js";

export type SignalId = string;

export type SignalType =
  | "NeedsClarification"
  | "StrongEvidence"
  | "WeakEvidence"
  | "Duplicate"
  | "NeedsExpertReview"
  | "RegionalImpact"
  | "HighPriority"
  | "ReadyForPoll";

export interface Signal {
  signalId: SignalId;
  memberId: MemberId;
  signalType: SignalType;
  targetType: string;
  targetId: string;
  createdAt: string;
}
