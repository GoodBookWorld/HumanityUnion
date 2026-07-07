import type { CivicActionPackage, RecommendedCivicDeliveryRecipient } from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCapById } from "../civic-action-package/civic-action-package.store.js";

function formatCommunityLabel(communitySlug: string): string {
  return communitySlug.replace(/-/g, " ");
}

function ministryLabel(activityArea: string): string {
  return `${activityArea} Ministry`;
}

/**
 * Rule-based recipient recommendations — no AI, no external lookup.
 */
export function recommendCivicDeliveryRecipients(
  capId: string,
): RecommendedCivicDeliveryRecipient[] {
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    return [];
  }

  const initiative = getInitiativeById(capPackage.initiativeId);

  if (!initiative) {
    return [];
  }

  const communityLabel = formatCommunityLabel(initiative.metadata.communitySlug);
  const region = initiative.metadata.region;
  const activityArea = initiative.metadata.activityArea;
  const scope = capPackage.participationScope;
  const recommendations: RecommendedCivicDeliveryRecipient[] = [];

  if (scope === "community" || scope === "region" || scope === "country" || scope === "world") {
    recommendations.push({
      name: `${communityLabel} Municipal Office`,
      organization: `City of ${communityLabel}`,
      recipientType: "municipality",
      email: `civic-delivery-municipality@${initiative.metadata.communitySlug}.example.org`,
      reason: `Community-scoped civic action affects local municipal governance for ${communityLabel}.`,
      source: "recommended",
    });
  }

  if (scope === "region" || scope === "country" || scope === "world") {
    recommendations.push({
      name: `${region} Regional Authority`,
      organization: `${region} Regional Government`,
      recipientType: "regional_government",
      email: `civic-delivery-region@${initiative.metadata.communitySlug}.example.org`,
      reason: `Regional participation scope requires notification to the ${region} regional authority.`,
      source: "recommended",
    });
  }

  if (scope === "country" || scope === "world") {
    recommendations.push({
      name: ministryLabel(activityArea),
      organization: `Federal ${activityArea} Ministry`,
      recipientType: "federal_government",
      email: `civic-delivery-federal@${initiative.metadata.communitySlug}.example.org`,
      reason: `National civic scope warrants federal ministry awareness for ${activityArea} matters.`,
      source: "recommended",
    });
  }

  if (scope === "region" || scope === "country") {
    recommendations.push({
      name: `${region} ${activityArea} Ministry`,
      organization: `Provincial ${activityArea} Ministry`,
      recipientType: "provincial_government",
      email: `civic-delivery-provincial@${initiative.metadata.communitySlug}.example.org`,
      reason: `Provincial ministry oversight applies to ${activityArea} initiatives in ${region}.`,
      source: "recommended",
    });
  }

  if (scope === "world") {
    recommendations.push({
      name: "International Civic Standards Office",
      organization: "International Organization for Civic Standards",
      recipientType: "international_organization",
      email: `civic-delivery-international@${initiative.metadata.communitySlug}.example.org`,
      reason: "World participation scope includes international civic transparency notification.",
      source: "recommended",
    });
  }

  recommendations.push({
    name: `${activityArea} Civic NGO Network`,
    organization: `${activityArea} Expertise Coalition`,
    recipientType: "ngo",
    email: `civic-delivery-ngo@${initiative.metadata.communitySlug}.example.org`,
    reason: `Issue-specific NGO expertise supports informed civic review of ${activityArea} initiatives.`,
    source: "recommended",
  });

  recommendations.push({
    name: "Regional Public Affairs Desk",
    organization: "Civic Media Network",
    recipientType: "media",
    email: `civic-delivery-media@${initiative.metadata.communitySlug}.example.org`,
    reason:
      "Public awareness supports transparent civic accountability for collective decision results.",
    source: "recommended",
  });

  if (initiative.metadata.category.toLowerCase().includes("education")) {
    recommendations.push({
      name: `${region} Civic Research Institute`,
      organization: `${region} University Civic Program`,
      recipientType: "university",
      email: `civic-delivery-university@${initiative.metadata.communitySlug}.example.org`,
      reason: "Educational civic initiatives benefit from university civic research engagement.",
      source: "recommended",
    });
  }

  return recommendations;
}

export function buildCapDeliverySummary(capPackage: CivicActionPackage): string {
  return `Civic Action Package #${capPackage.capNumber}: ${capPackage.title}`;
}
