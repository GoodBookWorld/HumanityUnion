import { INITIATIVE_LIFECYCLE_PHASE_LABELS } from "../initiative-lifecycle-labels";
import type { Initiative } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { WorkspaceEmptyState, WorkspaceSectionShell } from "../../initiative-workspace-ux";

interface InitiativeOverviewProps {
  initiative: Initiative | null;
  loading: boolean;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Not specified";
}

export function InitiativeOverview({ initiative, loading }: InitiativeOverviewProps) {
  return (
    <WorkspaceSectionShell
      purpose="Review initiative metadata, lifecycle phase, and civic context before continuing through the pipeline."
      loading={loading ? "Loading initiative overview..." : null}
      emptyState={
        !loading && !initiative ? (
          <WorkspaceEmptyState
            title="No initiative selected"
            explanation="Select an initiative to review its overview fields."
            nextStep="Choose an initiative from My Initiatives."
          />
        ) : null
      }
    >
      {initiative ? (
        <>
          <ProfileField label="Description" value={initiative.description} />
          <ProfileField
            label="Lifecycle Phase"
            value={INITIATIVE_LIFECYCLE_PHASE_LABELS[initiative.lifecyclePhase]}
          />
          <ProfileField label="Community" value={initiative.metadata.communitySlug} />
          <ProfileField label="Activity Area" value={initiative.metadata.activityArea} />
          <ProfileField label="Visibility" value={initiative.visibility.policy} />
          <ProfileField label="Category" value={initiative.metadata.category} />
          <ProfileField label="Tags" value={formatList(initiative.metadata.tags)} />
          <ProfileField label="Region" value={initiative.metadata.region} />
          <ProfileField label="Language" value={initiative.metadata.language} />
          <ProfileField label="Timeline Events" value={String(initiative.timeline.length)} />
          <ProfileField label="Revisions" value={String(initiative.revisions.length)} />
          <ProfileField label="Contributions" value={String(initiative.contributions.length)} />
        </>
      ) : null}
    </WorkspaceSectionShell>
  );
}
