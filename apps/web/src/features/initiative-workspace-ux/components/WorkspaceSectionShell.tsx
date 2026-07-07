import type { ReactNode } from "react";

import { WorkspaceDeferredActions } from "./WorkspaceDeferredActions";
import { WorkspaceErrorState } from "./WorkspaceErrorState";
import { WorkspaceLoadingState } from "./WorkspaceLoadingState";

export interface WorkspaceSectionShellProps {
  purpose?: ReactNode;
  metrics?: ReactNode;
  loading?: string | null;
  error?: string | null;
  children?: ReactNode;
  actions?: ReactNode;
  links?: ReactNode;
  emptyState?: ReactNode;
  deferredActions?: ReactNode;
}

export function WorkspaceSectionShell({
  purpose,
  metrics,
  loading,
  error,
  children,
  actions,
  links,
  emptyState,
  deferredActions,
}: WorkspaceSectionShellProps) {
  return (
    <div className="workspace-section">
      {purpose ? <p className="workspace-purpose">{purpose}</p> : null}
      {metrics}
      {loading ? <WorkspaceLoadingState message={loading} /> : null}
      {error ? <WorkspaceErrorState message={error} /> : null}
      {!loading && !error ? children : null}
      {actions ? <div className="workspace-actions">{actions}</div> : null}
      {links ? <div className="workspace-links">{links}</div> : null}
      {!loading && !error ? emptyState : null}
      {deferredActions}
    </div>
  );
}

export function WorkspacePurposeNote({ children }: { children: ReactNode }) {
  return <p className="workspace-purpose">{children}</p>;
}

export function WorkspaceHelperNote({ children }: { children: ReactNode }) {
  return <p className="workspace-helper-note">{children}</p>;
}

export function WorkspaceMetricsRow({ children }: { children: ReactNode }) {
  return <dl className="workspace-metrics">{children}</dl>;
}

export function WorkspaceStatusCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="workspace-status-card">
      <p className="workspace-status-card__label">{label}</p>
      <p className="workspace-status-card__value">{value}</p>
    </div>
  );
}

export { WorkspaceLoadingState } from "./WorkspaceLoadingState";
export { WorkspaceErrorState } from "./WorkspaceErrorState";
export { WorkspaceEmptyState } from "./WorkspaceEmptyState";
export type { WorkspaceEmptyStateProps } from "./WorkspaceEmptyState";
export { WorkspaceDeferredActions };
export type { WorkspaceDeferredActionsProps } from "./WorkspaceDeferredActions";
export { WorkspacePublicLink } from "./WorkspacePublicLink";
export { WorkspaceStatusBadge } from "./WorkspaceStatusBadge";
export { WorkspaceRecordList, WorkspaceRecordItem } from "./WorkspaceRecordList";
export { WorkspaceTimeline, WorkspaceTimelineItem } from "./WorkspaceTimeline";
export { WorkspaceButton } from "./WorkspaceButton";
