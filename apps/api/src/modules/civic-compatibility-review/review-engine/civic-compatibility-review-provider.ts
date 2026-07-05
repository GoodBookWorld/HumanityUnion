import type {
  CivicCompatibilityConcern,
  CivicCompatibilityRecommendation,
  CivicCompatibilityReview,
  CivicCompatibilityStatus,
  CivicReferenceFrameworkEntry,
  Initiative,
  ReviewedDocumentReference,
} from "@hu/types";

import { listPublishedAnalysesByInitiative } from "../../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { listProposalsByInitiative } from "../../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import { getCurrentPublishedVersion } from "../../initiative-version-revision/initiative-version-revision.store.js";
import {
  CIVIC_REFERENCE_FRAMEWORK,
  getFrameworkEntries,
} from "../reference-framework/civic-reference-framework.js";

export interface CivicCompatibilityReviewInput {
  initiative: Initiative;
  initiativeVersion: number;
}

export interface CivicCompatibilityReviewProviderResult {
  compatibilityStatus: CivicCompatibilityStatus;
  compatibilitySummary: string;
  humanRightsAssessment: string;
  humanityUnionAssessment: string;
  detectedConcerns: CivicCompatibilityConcern[];
  recommendations: CivicCompatibilityRecommendation[];
  reviewedDocuments: ReviewedDocumentReference[];
  referencedPrinciples: CivicReferenceFrameworkEntry[];
  referencedHumanRightsArticles: CivicReferenceFrameworkEntry[];
  positiveAlignment: string[];
  confidenceLevel: CivicCompatibilityReview["confidenceLevel"];
}

export interface CivicCompatibilityReviewProvider {
  readonly providerId: string;
  generateReview(input: CivicCompatibilityReviewInput): CivicCompatibilityReviewProviderResult;
}

const EXCLUSION_PATTERNS = [
  /\bexclude\b/i,
  /\bban\b/i,
  /\bdeny access\b/i,
  /\bonly for\b/i,
  /\bprohibited from\b/i,
];

const COERCIVE_PATTERNS = [/\bmust comply\b/i, /\bforced to\b/i, /\bno choice\b/i, /\bpunish\b/i];

const POSITIVE_PATTERNS = [
  {
    pattern: /\bcommunity\b/i,
    message: "Community-centered language supports cooperative civic participation.",
  },
  {
    pattern: /\btransparent\b/i,
    message: "Transparency language aligns with open civic process expectations.",
  },
  {
    pattern: /\bevidence\b/i,
    message: "Evidence-oriented language supports informed participation.",
  },
  {
    pattern: /\bvoluntary\b/i,
    message: "Voluntary participation language respects freedom with understanding.",
  },
  {
    pattern: /\bimprovement\b/i,
    message: "Improvement-oriented framing supports iterative civic refinement.",
  },
];

function buildReviewedDocuments(
  initiative: Initiative,
  version: number,
): ReviewedDocumentReference[] {
  const documents: ReviewedDocumentReference[] = [
    {
      documentType: "initiative",
      documentId: initiative.initiativeId,
      documentLabel: initiative.title,
      version,
    },
  ];

  for (const analysis of listPublishedAnalysesByInitiative(initiative.initiativeId)) {
    documents.push({
      documentType: "analysis",
      documentId: analysis.analysisId,
      documentLabel: analysis.title,
      version: analysis.initiativeVersion,
    });
  }

  for (const proposal of listProposalsByInitiative(initiative.initiativeId)) {
    documents.push({
      documentType: "proposal",
      documentId: proposal.proposalId,
      documentLabel: `${proposal.targetSection}: ${proposal.proposedChange}`,
    });
  }

  return documents;
}

function resolveStatus(concerns: CivicCompatibilityConcern[]): CivicCompatibilityStatus {
  const highSeverity = concerns.filter((concern) => concern.severity === "high").length;
  const mediumSeverity = concerns.filter((concern) => concern.severity === "medium").length;

  if (highSeverity > 0) {
    return "manual_review_recommended";
  }

  if (mediumSeverity > 0) {
    return "potential_conflict";
  }

  if (concerns.length > 0) {
    return "compatible_with_recommendations";
  }

  return "compatible";
}

export class RuleBasedCivicCompatibilityReviewProvider implements CivicCompatibilityReviewProvider {
  readonly providerId = "rule-based-v1";

  generateReview(input: CivicCompatibilityReviewInput): CivicCompatibilityReviewProviderResult {
    const { initiative } = input;
    const corpus = `${initiative.title}\n${initiative.description}`.toLowerCase();
    const detectedConcerns: CivicCompatibilityConcern[] = [];
    const recommendations: CivicCompatibilityRecommendation[] = [];
    const positiveAlignment: string[] = [];
    const referencedPrincipleIds = new Set<string>();
    const referencedHumanRightsIds = new Set<string>();

    if (initiative.description.trim().length < 40) {
      detectedConcerns.push({
        concernId: "concern-insufficient-detail",
        category: "Clarity",
        summary: "Initiative description may be too brief for informed public review.",
        explanation:
          "Short descriptions make it harder for participants to evaluate intent, scope, and potential impact before contributing analyses or proposals.",
        severity: "low",
        referencedFrameworkIds: ["hu-constitution-article-ii", "hu-principle-evidence"],
      });
      recommendations.push({
        recommendationId: "recommendation-expand-description",
        summary:
          "Expand the initiative description with scope, intended outcomes, and affected communities.",
        explanation:
          "Richer context helps participants apply evidence before opinions and improves improvement proposals.",
        suggestedImprovement:
          "Add sections describing who benefits, what changes, and what evidence supports the proposal.",
        referencedFrameworkIds: ["hu-constitution-article-ii", "hu-principle-evidence"],
      });
      referencedPrincipleIds.add("hu-constitution-article-ii");
      referencedPrincipleIds.add("hu-principle-evidence");
    }

    for (const pattern of EXCLUSION_PATTERNS) {
      if (pattern.test(corpus)) {
        detectedConcerns.push({
          concernId: "concern-exclusionary-language",
          category: "Human Rights",
          summary: "Language may imply exclusion or unequal access.",
          explanation:
            "Initiatives that appear to restrict participation by group identity may conflict with equal dignity and non-discrimination expectations.",
          severity: "high",
          referencedFrameworkIds: ["hu-constitution-article-i", "udhr-article-2"],
        });
        recommendations.push({
          recommendationId: "recommendation-inclusive-framing",
          summary: "Reframe the initiative using inclusive, equal-access language.",
          explanation:
            "Replacing exclusionary phrasing with voluntary, community-wide participation language reduces potential human rights conflicts.",
          suggestedImprovement:
            "Describe eligibility criteria in terms of role, geography, or consent rather than protected characteristics.",
          referencedFrameworkIds: ["hu-constitution-article-i", "udhr-article-2"],
        });
        referencedPrincipleIds.add("hu-constitution-article-i");
        referencedHumanRightsIds.add("udhr-article-2");
        break;
      }
    }

    for (const pattern of COERCIVE_PATTERNS) {
      if (pattern.test(corpus)) {
        detectedConcerns.push({
          concernId: "concern-coercive-language",
          category: "Freedom",
          summary: "Language may suggest coercion rather than voluntary participation.",
          explanation:
            "Humanity Union guides without coercing. Mandatory or punitive framing can undermine freedom with understanding.",
          severity: "medium",
          referencedFrameworkIds: ["hu-constitution-article-iii", "udhr-article-20"],
        });
        recommendations.push({
          recommendationId: "recommendation-voluntary-framing",
          summary: "Use voluntary, opt-in language for participation and implementation steps.",
          explanation:
            "Voluntary civic participation preserves freedom of association and expression while still enabling collective action.",
          suggestedImprovement:
            "Replace mandatory phrasing with invitations, opt-in commitments, or steward-supported participation pathways.",
          referencedFrameworkIds: ["hu-constitution-article-iii", "udhr-article-20"],
        });
        referencedPrincipleIds.add("hu-constitution-article-iii");
        referencedHumanRightsIds.add("udhr-article-20");
        break;
      }
    }

    if (initiative.visibility.policy !== "public") {
      recommendations.push({
        recommendationId: "recommendation-public-transparency",
        summary: "Consider public visibility to strengthen transparency before authority.",
        explanation:
          "Public initiatives allow broader scrutiny, collaborative analysis, and improvement proposals before decisions.",
        suggestedImprovement:
          "If appropriate, set initiative visibility to public so the civic process remains open and auditable.",
        referencedFrameworkIds: ["hu-constitution-article-vii", "hu-principle-transparency"],
      });
      referencedPrincipleIds.add("hu-constitution-article-vii");
      referencedPrincipleIds.add("hu-principle-transparency");
    } else {
      positiveAlignment.push(
        "Public visibility supports transparency and trust in the civic process.",
      );
      referencedPrincipleIds.add("hu-constitution-article-vii");
    }

    for (const { pattern, message } of POSITIVE_PATTERNS) {
      if (pattern.test(corpus)) {
        positiveAlignment.push(message);
      }
    }

    if (listPublishedAnalysesByInitiative(initiative.initiativeId).length > 0) {
      positiveAlignment.push(
        "Published collaborative analyses demonstrate evidence-oriented collective intelligence work.",
      );
      referencedPrincipleIds.add("hu-principle-evidence");
    }

    if (getCurrentPublishedVersion(initiative.initiativeId) > 1) {
      positiveAlignment.push(
        "Revision history shows improvement-before-decisions practice through published updates.",
      );
      referencedPrincipleIds.add("hu-principle-improvement");
    }

    const compatibilityStatus = resolveStatus(detectedConcerns);
    const referencedPrinciples = getFrameworkEntries([...referencedPrincipleIds]).filter(
      (entry) => entry.frameworkType === "constitution" || entry.frameworkType === "principles",
    );
    const referencedHumanRightsArticles = getFrameworkEntries([...referencedHumanRightsIds]);

    const compatibilitySummary =
      compatibilityStatus === "compatible"
        ? "No significant civic compatibility concerns were detected. The initiative aligns with Humanity Union principles and fundamental human rights expectations."
        : compatibilityStatus === "compatible_with_recommendations"
          ? "The initiative appears broadly compatible, but minor improvements could strengthen clarity and civic alignment."
          : compatibilityStatus === "potential_conflict"
            ? "Potential compatibility concerns were detected. Review recommendations before advancing to public decision preparation."
            : "Significant compatibility concerns were detected. Manual human review is recommended, but publication remains your choice.";

    return {
      compatibilityStatus,
      compatibilitySummary,
      humanRightsAssessment:
        referencedHumanRightsArticles.length > 0
          ? "Review detected language or framing that may affect equal dignity, non-discrimination, expression, or peaceful association."
          : "No major human rights conflicts were detected in the reviewed initiative text.",
      humanityUnionAssessment:
        "Assessment applied Humanity Union constitutional articles and civic principles emphasizing dignity, knowledge, voluntary participation, and transparency.",
      detectedConcerns,
      recommendations,
      reviewedDocuments: buildReviewedDocuments(initiative, input.initiativeVersion),
      referencedPrinciples,
      referencedHumanRightsArticles,
      positiveAlignment,
      confidenceLevel: detectedConcerns.some((concern) => concern.severity === "high")
        ? "medium"
        : "high",
    };
  }
}

export function resolveCivicCompatibilityReviewProvider(): CivicCompatibilityReviewProvider {
  const mode = process.env.CIVIC_COMPATIBILITY_REVIEW_PROVIDER ?? "rule-based";

  switch (mode) {
    case "rule-based":
    default:
      return new RuleBasedCivicCompatibilityReviewProvider();
  }
}

export function getAvailableFrameworkEntries(): CivicReferenceFrameworkEntry[] {
  return structuredClone(CIVIC_REFERENCE_FRAMEWORK);
}
