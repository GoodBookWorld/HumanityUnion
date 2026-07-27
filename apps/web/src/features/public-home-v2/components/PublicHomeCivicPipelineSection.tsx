"use client";

import {
  HuxWorkflowSection,
  HuxWorkflowStage,
} from "../../horizontal-experience";
import { PUBLIC_HOME_CIVIC_PIPELINE } from "../constants";

export function PublicHomeCivicPipelineSection() {
  const stages = PUBLIC_HOME_CIVIC_PIPELINE.map((step) => ({
    id: step.id,
    title: step.label,
    description: step.explanation,
    highlighted: step.id === "initiative",
  }));

  return (
    <HuxWorkflowSection
      sectionId="public-home-pipeline"
      eyebrow="CIVIC WORKFLOW"
      title="How civic action works"
      description="A structured path from shared problems to documented public results."
      label="civic workflow stages"
      items={stages}
      getItemKey={(stage) => stage.id}
      viewportClassName="hux-workflow-rail"
      renderItem={(stage, index) => (
        <HuxWorkflowStage stage={stage} index={index} totalStages={stages.length} />
      )}
    />
  );
}
