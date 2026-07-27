export type InitiativeSupportStoredSignal = "like" | "dislike";

export type InitiativeSupportActorCohort = "participants" | "members" | "visitors";

export interface InitiativeSupportRegisteredSignalRecord {
  signalId: string;
  initiativeId: string;
  actorUserId: string;
  actorCohortSnapshot: Exclude<InitiativeSupportActorCohort, "visitors">;
  signal: InitiativeSupportStoredSignal;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeSupportVisitorSignalRecord {
  signalId: string;
  initiativeId: string;
  visitorKey: string;
  signal: InitiativeSupportStoredSignal;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeSupportBookmarkRecord {
  initiativeId: string;
  userId: string;
  createdAt: string;
}

export interface InitiativeSupportViewRecord {
  initiativeId: string;
  viewerKey: string;
  viewedAt: string;
}
