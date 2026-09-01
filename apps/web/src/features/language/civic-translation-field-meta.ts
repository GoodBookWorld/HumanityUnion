/**
 * Pack 02G Task 05 — shared field orders/labels for civic public translated display.
 * Keys match CONTENT_TRANSLATION_FIELD_ALLOWLIST / civic loaders.
 */

export const CIVIC_TRANSLATION_FIELD_META = {
  improvement_proposal: {
    fieldOrder: [
      "targetSection",
      "currentIssue",
      "proposedChange",
      "rationale",
      "expectedImprovement",
      "references",
      "decisionNote",
    ] as const,
    fieldLabels: {
      targetSection: "Target section",
      currentIssue: "Current issue",
      proposedChange: "Proposed change",
      rationale: "Rationale",
      expectedImprovement: "Expected improvement",
      references: "References",
      decisionNote: "Steward decision note",
    },
  },
  initiative_revision: {
    fieldOrder: ["revisionSummary", "title", "description", "changes"] as const,
    fieldLabels: {
      revisionSummary: "Revision summary",
      title: "Title",
      description: "Description",
      changes: "Changes",
    },
  },
  decision_session: {
    fieldOrder: ["title", "purpose", "decisionQuestion", "structuredContent"] as const,
    fieldLabels: {
      title: "Title",
      purpose: "Purpose",
      decisionQuestion: "Decision question",
      structuredContent: "Structured content",
    },
  },
  collective_decision: {
    fieldOrder: ["question", "outcomeSummary", "transparencyNote", "structuredContent"] as const,
    fieldLabels: {
      question: "Decision question",
      outcomeSummary: "Outcome summary",
      transparencyNote: "Transparency note",
      structuredContent: "Structured content",
    },
  },
  implementation_commitment: {
    fieldOrder: [
      "title",
      "summary",
      "organization",
      "commitmentScope",
      "approvedAction",
      "suggestedResponsibleRole",
      "priority",
      "requiredResources",
      "relatedRisks",
      "references",
    ] as const,
    fieldLabels: {
      title: "Title",
      summary: "Summary",
      organization: "Organization",
      commitmentScope: "Commitment scope",
      approvedAction: "Approved action",
      suggestedResponsibleRole: "Suggested responsible role",
      priority: "Priority",
      requiredResources: "Required resources",
      relatedRisks: "Related risks",
      references: "References",
    },
  },
  implementation_tracking: {
    fieldOrder: [
      "currentStage",
      "summary",
      "notes",
      "approvedAction",
      "dependencies",
      "obstacles",
      "evidenceReferences",
      "executionHistory",
    ] as const,
    fieldLabels: {
      currentStage: "Current stage",
      summary: "Summary",
      notes: "Notes",
      approvedAction: "Approved action",
      dependencies: "Dependencies",
      obstacles: "Obstacles",
      evidenceReferences: "Evidence references",
      executionHistory: "Execution history",
    },
  },
  official_response: {
    fieldOrder: ["subject", "summary", "responseReference", "organizationName"] as const,
    fieldLabels: {
      subject: "Subject",
      summary: "Summary",
      responseReference: "Response reference",
      organizationName: "Organization",
    },
  },
  public_impact: {
    fieldOrder: [
      "title",
      "summary",
      "observedImpact",
      "affectedCommunity",
      "evidenceSummary",
      "evidence",
    ] as const,
    fieldLabels: {
      title: "Title",
      summary: "Summary",
      observedImpact: "Observed impact",
      affectedCommunity: "Affected community",
      evidenceSummary: "Evidence summary",
      evidence: "Evidence",
    },
  },
  civic_archive: {
    fieldOrder: [
      "title",
      "summary",
      "implementationPeriod",
      "initiativeSummary",
      "civicChallenge",
      "implementationStory",
      "verifiedPublicImpact",
      "lessonsLearned_whatWorked",
      "lessonsLearned_whatDidNotWork",
      "lessonsLearned_recommendationsForFuture",
      "lessonsLearned_transferableExperience",
      "knowledgeContribution_socialBenefits",
      "knowledgeContribution_environmentalBenefits",
      "knowledgeContribution_economicBenefits",
      "knowledgeContribution_governanceBenefits",
      "knowledgeContribution_educationalBenefits",
      "knowledgeContribution_additionalObservations",
      "timelineLabels",
    ] as const,
    fieldLabels: {
      title: "Title",
      summary: "Summary",
      implementationPeriod: "Implementation period",
      initiativeSummary: "Initiative summary",
      civicChallenge: "Civic challenge",
      implementationStory: "Implementation story",
      verifiedPublicImpact: "Verified public impact",
      lessonsLearned_whatWorked: "What worked",
      lessonsLearned_whatDidNotWork: "What did not work",
      lessonsLearned_recommendationsForFuture: "Recommendations for future",
      lessonsLearned_transferableExperience: "Transferable experience",
      knowledgeContribution_socialBenefits: "Social benefits",
      knowledgeContribution_environmentalBenefits: "Environmental benefits",
      knowledgeContribution_economicBenefits: "Economic benefits",
      knowledgeContribution_governanceBenefits: "Governance benefits",
      knowledgeContribution_educationalBenefits: "Educational benefits",
      knowledgeContribution_additionalObservations: "Additional observations",
      timelineLabels: "Timeline",
    },
  },
  civic_media: {
    fieldOrder: [
      "overviewTitle",
      "overviewSummary",
      "overviewPoints",
      "selectionPrinciples",
      "faq",
      "initiativeFlowTitle",
      "initiativeFlowSummary",
      "initiativeFlowStages",
    ] as const,
    fieldLabels: {
      overviewTitle: "Overview",
      overviewSummary: "Overview summary",
      overviewPoints: "Overview points",
      selectionPrinciples: "Selection principles",
      faq: "FAQ",
      initiativeFlowTitle: "Initiative flow",
      initiativeFlowSummary: "Flow summary",
      initiativeFlowStages: "Flow stages",
    },
  },
} as const;

/** Stable JSON stringify matching API civic loader serialization order. */
export function stableJsonForDisplay(value: unknown): string {
  return JSON.stringify(value);
}

export function joinLinesForDisplay(values: readonly string[] | null | undefined): string {
  if (!values || values.length === 0) {
    return "";
  }
  return values.join("\n");
}
