/** Humanity Union Horizontal Experience System — section experience variants. */
export type HuxExperienceVariant = "discovery" | "directory" | "workflow" | "education";

export interface HuxWorkflowStageItem {
  id: string;
  title: string;
  description: string;
  highlighted?: boolean;
}
