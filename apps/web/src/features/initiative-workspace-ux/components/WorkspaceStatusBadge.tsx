import type { WorkspaceBadgeVariant } from "../status-badge";
import { formatWorkspaceStatusLabel, resolveWorkspaceBadgeVariant } from "../status-badge";

interface WorkspaceStatusBadgeProps {
  status: string;
  variant?: WorkspaceBadgeVariant;
}

export function WorkspaceStatusBadge({ status, variant }: WorkspaceStatusBadgeProps) {
  const resolvedVariant = variant ?? resolveWorkspaceBadgeVariant(status);

  return (
    <span className={`workspace-badge workspace-badge--${resolvedVariant}`}>
      {formatWorkspaceStatusLabel(status)}
    </span>
  );
}
