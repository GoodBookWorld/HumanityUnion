export interface CivicPipelineStageDefinition {
  id: string;
  title: string;
  description: string;
  highlighted?: boolean;
}

export const CIVIC_PIPELINE_STAGES: CivicPipelineStageDefinition[] = [
  {
    id: "news",
    title: "News",
    description: "A verified event enters the civic workspace.",
  },
  {
    id: "verification",
    title: "Verification",
    description: "Members examine the source, evidence, and context.",
  },
  {
    id: "discussion",
    title: "Discussion",
    description: "Participants identify concerns, affected communities, and possible responses.",
  },
  {
    id: "initiative",
    title: "Initiative",
    description: "A Member converts the verified event into a civic initiative.",
    highlighted: true,
  },
  {
    id: "analysis",
    title: "Analysis",
    description: "Participants examine causes, consequences, and available solutions.",
  },
  {
    id: "proposal",
    title: "Proposal",
    description: "A concrete course of action is developed.",
  },
  {
    id: "decision",
    title: "Decision",
    description: "The community or responsible institution evaluates and adopts a decision.",
  },
  {
    id: "implementation",
    title: "Implementation",
    description: "Members and institutions carry out agreed actions.",
  },
  {
    id: "impact",
    title: "Impact",
    description: "Results are measured and made visible.",
  },
  {
    id: "archive",
    title: "Archive",
    description: "The full civic record remains publicly accessible.",
  },
];
