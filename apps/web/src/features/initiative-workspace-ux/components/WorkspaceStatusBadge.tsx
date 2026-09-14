import type { WorkspaceBadgeVariant } from "../status-badge";
import { formatWorkspaceStatusLabel, resolveWorkspaceBadgeVariant } from "../status-badge";

interface WorkspaceStatusBadgeProps {
  status: string;
  variant?: WorkspaceBadgeVariant;
  /** Display-only override. Canonical `status` is never mutated. */
  label?: string;
}

export function WorkspaceStatusBadge({ status, variant, label }: WorkspaceStatusBadgeProps) {
  const resolvedVariant = variant ?? resolveWorkspaceBadgeVariant(status);

  return (
    <span className={`workspace-badge workspace-badge--${resolvedVariant}`}>
      {label ?? formatWorkspaceStatusLabel(status)}
    </span>
  );
}
