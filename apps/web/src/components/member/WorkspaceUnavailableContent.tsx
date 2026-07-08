import { ApiUnavailableState } from "../../design-system";

interface WorkspaceUnavailableContentProps {
  title: string;
  explanation: string;
  retryHref: string;
}

export function WorkspaceUnavailableContent({
  title,
  explanation,
  retryHref,
}: WorkspaceUnavailableContentProps) {
  return (
    <div className="workspace-unavailable-center">
      <ApiUnavailableState
        title={title}
        explanation={explanation}
        retryHref={retryHref}
        retryLabel="Retry"
        homeLabel="Return Home"
      />
    </div>
  );
}
