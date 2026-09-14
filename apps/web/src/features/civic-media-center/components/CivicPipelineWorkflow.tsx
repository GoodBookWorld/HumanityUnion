"use client";

import { useTranslations } from "next-intl";

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
  title,
  description,
  stageTitles,
}: CivicPipelineWorkflowProps = {}) {
  const t = useTranslations("civicMediaPublic.pipeline");
  const stages = CIVIC_PIPELINE_STAGES.map((stage, index) => {
    const overlayTitle = stageTitles?.[index]?.trim();
    return {
      ...stage,
      title: overlayTitle || t(`stages.${stage.id}.title`),
      description: t(`stages.${stage.id}.description`),
    };
  });

  return (
    <HuxWorkflowSection
      sectionId="initiative-flow"
      eyebrow={t("eyebrow")}
      title={title ?? t("title")}
      description={description ?? t("description")}
      label={t("label")}
      items={stages}
      getItemKey={(stage) => stage.id}
      viewportClassName="hux-workflow-rail"
      renderItem={(stage, index) => (
        <HuxWorkflowStage stage={stage} index={index} totalStages={stages.length} />
      )}
    />
  );
}
