import {
  WORKSPACE_DEFERRED_AUTHOR_TITLE,
  WORKSPACE_DEFERRED_TOOLTIP_API,
  WORKSPACE_DEFERRED_TOOLTIP_AUTHOR,
} from "../constants";

import { WorkspaceButton } from "./WorkspaceButton";

export interface WorkspaceDeferredActionsProps {
  title?: string;
  note: string;
  actions: string[];
  tooltip?: string;
  authorWorkflow?: boolean;
}

export function WorkspaceDeferredActions({
  title = WORKSPACE_DEFERRED_AUTHOR_TITLE,
  note,
  actions,
  tooltip,
  authorWorkflow = false,
}: WorkspaceDeferredActionsProps) {
  const resolvedTooltip =
    tooltip ??
    (authorWorkflow ? WORKSPACE_DEFERRED_TOOLTIP_AUTHOR : WORKSPACE_DEFERRED_TOOLTIP_API);

  return (
    <div className="workspace-deferred">
      <p className="workspace-deferred__title">{title}</p>
      <p className="workspace-deferred__note">{note}</p>
      <div className="workspace-deferred__actions">
        {actions.map((action) => (
          <WorkspaceButton key={action} variant="disabled" disabled title={resolvedTooltip}>
            {action}
          </WorkspaceButton>
        ))}
      </div>
    </div>
  );
}
