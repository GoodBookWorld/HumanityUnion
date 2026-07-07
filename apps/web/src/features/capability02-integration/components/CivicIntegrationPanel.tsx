import { ProfileSection } from "../../../components/member/ProfileSection";
import { getCivicIntegrationView, type IntegrationUrlEntityType } from "../api";

import {
  CivicBreadcrumb,
  CivicContextPanel,
  CivicPipelineStatusPanel,
  RelatedCivicRecordsPanel,
} from "./CivicIntegrationWidgets";

import "./capability02-integration.css";

interface CivicIntegrationPanelProps {
  entityType: IntegrationUrlEntityType;
  entityId: string;
}

export async function CivicIntegrationPanel({ entityType, entityId }: CivicIntegrationPanelProps) {
  const view = await getCivicIntegrationView(entityType, entityId);

  if (!view) {
    return null;
  }

  return (
    <ProfileSection title="Civic Integration">
      <div className="capability02-integration">
        <CivicBreadcrumb items={view.breadcrumb} />
        <CivicPipelineStatusPanel status={view.pipelineStatus} />
        <CivicContextPanel
          title={view.context.title}
          summary={view.context.summary}
          sections={view.context.relatedSections}
        />
        <RelatedCivicRecordsPanel records={view.relatedRecords} />
      </div>
    </ProfileSection>
  );
}
