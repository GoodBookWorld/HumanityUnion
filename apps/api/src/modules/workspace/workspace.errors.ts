export class WorkspaceProjectionValidationError extends Error {
  readonly code = "WORKSPACE_PROJECTION_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "WorkspaceProjectionValidationError";
  }
}

export class WorkspaceMemberNotRegisteredError extends Error {
  readonly code = "WORKSPACE_MEMBER_NOT_REGISTERED";

  constructor(message = "Registered Member record is required to access Workspace.") {
    super(message);
    this.name = "WorkspaceMemberNotRegisteredError";
  }
}

export class WorkspaceQueryUnavailableError extends Error {
  readonly code = "WORKSPACE_QUERY_UNAVAILABLE";

  constructor(message = "Workspace query persistence is unavailable.") {
    super(message);
    this.name = "WorkspaceQueryUnavailableError";
  }
}

export class WorkspaceProjectionNotReadyError extends Error {
  readonly code = "WORKSPACE_PROJECTION_NOT_READY";

  constructor(message = "Workspace projection is not yet materialized for this Member.") {
    super(message);
    this.name = "WorkspaceProjectionNotReadyError";
  }
}

export class WorkspaceProjectionOrderingNotReadyError extends Error {
  readonly code = "WORKSPACE_PROJECTION_ORDERING_NOT_READY";

  constructor(message = "Workspace projection prerequisite state is not yet available for this event.") {
    super(message);
    this.name = "WorkspaceProjectionOrderingNotReadyError";
  }
}
