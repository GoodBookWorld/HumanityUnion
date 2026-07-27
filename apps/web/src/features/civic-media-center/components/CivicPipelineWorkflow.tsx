"use client";

import {
  HuxWorkflowSection,
  HuxWorkflowStage,
} from "../../horizontal-experience";
import { CIVIC_PIPELINE_STAGES } from "../civic-pipeline-workflow.stages";

export function CivicPipelineWorkflow() {
  return (
    <HuxWorkflowSection
      sectionId="initiative-flow"
      eyebrow="CIVIC PIPELINE"
      title="How News Creates Initiatives"
      description="Verified information moves through discussion, analysis, decision, and public impact."
      label="civic workflow stages"
      items={CIVIC_PIPELINE_STAGES}
      getItemKey={(stage) => stage.id}
      viewportClassName="hux-workflow-rail"
      renderItem={(stage, index) => (
        <HuxWorkflowStage stage={stage} index={index} totalStages={CIVIC_PIPELINE_STAGES.length} />
      )}
    />
  );
}
