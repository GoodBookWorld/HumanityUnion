"use client";

import {
  HuxWorkflowSection,
  HuxWorkflowStage,
} from "../../horizontal-experience";
import { CIVIC_PIPELINE_STAGES } from "../civic-pipeline-workflow.stages";

interface CivicPipelineWorkflowProps {
  readonly title?: string;
  readonly description?: string;
  /** Optional stage title overlays (e.g. from translated initiativeFlowStages). */
  readonly stageTitles?: readonly string[];
}

export function CivicPipelineWorkflow({
  title = "How News Creates Initiatives",
  description = "Verified information moves through discussion, analysis, decision, and public impact.",
  stageTitles,
}: CivicPipelineWorkflowProps = {}) {
  const stages =
    stageTitles && stageTitles.length === CIVIC_PIPELINE_STAGES.length
      ? CIVIC_PIPELINE_STAGES.map((stage, index) => ({
          ...stage,
          title: stageTitles[index]!.trim() || stage.title,
        }))
      : CIVIC_PIPELINE_STAGES;

  return (
    <HuxWorkflowSection
      sectionId="initiative-flow"
      eyebrow="CIVIC PIPELINE"
      title={title}
      description={description}
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
