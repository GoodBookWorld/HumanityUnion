"use client";

import { useTranslations } from "next-intl";

import {
  HuxWorkflowSection,
  HuxWorkflowStage,
} from "../../horizontal-experience";
import { PUBLIC_HOME_CIVIC_PIPELINE } from "../constants";

export function PublicHomeCivicPipelineSection() {
  const t = useTranslations("publicHome");

  const stages = PUBLIC_HOME_CIVIC_PIPELINE.map((step) => ({
    id: step.id,
    title: t(`pipeline.${step.id}.label`),
    description: t(`pipeline.${step.id}.explanation`),
    highlighted: step.id === "initiative",
  }));

  return (
    <HuxWorkflowSection
      sectionId="public-home-pipeline"
      eyebrow={t("pipeline.eyebrow")}
      title={t("pipeline.title")}
      description={t("pipeline.description")}
      label={t("pipeline.ariaLabel")}
      items={stages}
      getItemKey={(stage) => stage.id}
      viewportClassName="hux-workflow-rail"
      renderItem={(stage, index) => (
        <HuxWorkflowStage stage={stage} index={index} totalStages={stages.length} />
      )}
    />
  );
}
