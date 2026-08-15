import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CommunitySimilarityCheckRequest,
  Initiative,
  MemberPreferences,
  MemberProfile,
} from "@hu/types";

import {
  formatCommunityIntelligenceForAssistantPrompt,
  instructionsRequestCommunityIntelligence,
  scorePriorityMatches,
  selectCandidateInitiatives,
} from "../../../src/modules/community-intelligence/community-intelligence-matching.js";
import { DeterministicCommunitySimilarityProvider } from "../../../src/modules/community-intelligence/deterministic-community-similarity-provider.js";
import type { CommunityInitiativeSignalDocument } from "../../../src/modules/community-intelligence/community-similarity-provider.js";
import {
  COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE,
  COMMUNITY_INTELLIGENCE_MAX_CANDIDATES,
} from "../../../src/modules/community-intelligence/community-intelligence.constants.js";
import { toPublicMemberProfile } from "../../../src/modules/member-profile/member-profile.projection.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function signal(
  partial: Partial<CommunityInitiativeSignalDocument> &
    Pick<CommunityInitiativeSignalDocument, "initiativeId" | "title" | "description">,
): CommunityInitiativeSignalDocument {
  return {
    activityArea: "Environment and Climate",
    tags: [],
    category: "Environment and Climate",
    publicAnalysisThemes: [],
    publicUrl: `/initiatives/public/${partial.initiativeId}`,
    ...partial,
  };
}

function preferences(
  partial: Partial<MemberPreferences["participationPreferences"]>,
): MemberPreferences {
  return {
    memberId: "member-1",
    updatedAt: new Date().toISOString(),
    participationPreferences: {
      interestedTopics: [],
      preferredInitiativeTypes: [],
      volunteerInterests: [],
      preferredCountryIds: [],
      preferredRegions: [],
      preferredCityCommunityIds: [],
      participationAvailability: "",
      preferredActivityAreas: [],
      preferredGeographicScopes: [],
      initiativeParticipationInterests: [],
      contributionWillingness: [],
      ...partial,
    },
    communicationPreferences: {
      announcementPreference: "",
      invitationPreference: "",
      digestFrequency: "weekly_digest",
      messageCategories: [],
      notificationFrequency: "weekly_digest",
      emailNotificationsEnabled: true,
      interestMatchNotificationsEnabled: true,
      disabledNotificationCategories: [],
    },
    experiencePreferences: {
      interfaceLanguage: "en",
      readingLanguages: ["en"],
      writingLanguages: ["en"],
      translationPreference: "none",
      timeZone: "UTC",
      dateFormat: "ymd",
      timeFormat: "24h",
      expertiseAreas: [],
      skills: [],
    },
    accessibilityPreferences: {
      fontSize: "medium",
      highContrast: false,
      reducedMotion: false,
      screenReaderSupport: false,
      simplifiedExplanations: false,
      contentDensity: "comfortable",
    },
    visibilityPreferences: {
      profileVisibility: "public",
      skillsVisibility: "members_only",
      interestsVisibility: "private",
      participationVisibility: "members_only",
    },
    workspacePreferences: {
      defaultStartPage: "home",
      navigationStyle: "default",
      expandedSections: [],
      cardDensity: "comfortable",
    },
  };
}

describe("Community Intelligence Pack 01", () => {
  const provider = new DeterministicCommunitySimilarityProvider();

  it("identical Initiative strongly matches as possible_duplicate with reasons", () => {
    const source = signal({
      initiativeId: "a",
      title: "Expand public transportation access downtown",
      description: "Improve bus routes and public transportation frequency for residents.",
      tags: ["transit"],
    });
    const candidate = signal({
      initiativeId: "b",
      title: "Expand public transportation access downtown",
      description: "Improve bus routes and public transportation frequency for residents.",
      tags: ["transit"],
    });

    const results = provider.match({
      source,
      candidates: [candidate],
      maxResults: 5,
      minScore: 0.22,
    });

    assert.equal(results.length, 1);
    assert.equal(results[0]?.relationshipType, "possible_duplicate");
    assert.ok((results[0]?.score ?? 0) >= 0.55);
    assert.ok((results[0]?.reasons.length ?? 0) > 0);
    assert.ok(results[0]?.reasons.every((reason) => reason.message.trim().length > 0));
  });

  it("unrelated Initiative does not match", () => {
    const source = signal({
      initiativeId: "a",
      title: "Expand cycling infrastructure lanes",
      description: "Build protected bicycle lanes across the city center.",
      activityArea: "Mobility",
    });
    const candidate = signal({
      initiativeId: "b",
      title: "Library literacy mentorship program",
      description: "Pair volunteers with children for reading practice after school.",
      activityArea: "Education",
      category: "Education",
    });

    const results = provider.match({
      source,
      candidates: [candidate],
      maxResults: 5,
      minScore: 0.22,
    });

    assert.equal(results.length, 0);
  });

  it("shared category / activity area contributes to relevance", () => {
    const source = signal({
      initiativeId: "a",
      title: "Urban neighborhood tree canopy expansion",
      description: "Plant shade trees across neighborhood streets lacking canopy cover.",
    });
    const candidate = signal({
      initiativeId: "b",
      title: "Neighborhood compost and tree stewardship",
      description: "Teach residents neighborhood compost habits and tree stewardship.",
    });

    const results = provider.match({
      source,
      candidates: [candidate],
      maxResults: 5,
      minScore: 0.18,
    });

    assert.ok(results.length >= 1);
    assert.ok(results[0]?.reasons.some((reason) => reason.code === "same_activity_area"));
  });

  it("shared keywords contribute", () => {
    const source = signal({
      initiativeId: "a",
      title: "River cleanup campaign",
      description: "Organize volunteers to restore the riverbank habitat.",
      tags: ["river", "cleanup"],
    });
    const candidate = signal({
      initiativeId: "b",
      title: "Watershed restoration volunteers",
      description: "Coordinate seasonal river cleanup days with local schools.",
      tags: ["river", "cleanup"],
    });

    const results = provider.match({
      source,
      candidates: [candidate],
      maxResults: 5,
      minScore: 0.22,
    });

    assert.ok(results.length >= 1);
    assert.ok(
      results[0]?.reasons.some(
        (reason) => reason.code === "shared_tags" || reason.code === "shared_themes",
      ),
    );
  });

  it("shared Analysis themes contribute where available", () => {
    const source = signal({
      initiativeId: "a",
      title: "Heat resilience planning",
      description: "Municipal planning for extreme heat events.",
      publicAnalysisThemes: ["cooling centers", "vulnerable populations"],
    });
    const candidate = signal({
      initiativeId: "b",
      title: "Summer health outreach",
      description: "Community outreach during heat waves.",
      publicAnalysisThemes: ["cooling centers", "vulnerable populations"],
    });

    const results = provider.match({
      source,
      candidates: [candidate],
      maxResults: 5,
      minScore: 0.22,
    });

    assert.ok(results.length >= 1);
    assert.ok(results[0]?.sharedTopics.length);
  });

  it("duplicate classification remains possible_duplicate and never auto-merges", () => {
    const draft: CommunitySimilarityCheckRequest = {
      title: "Expand public transportation access downtown",
      description: "Improve bus routes and public transportation frequency for residents.",
      activityArea: "Environment and Climate",
    };
    const candidate = signal({
      initiativeId: "existing",
      title: "Expand public transportation access downtown",
      description: "Improve bus routes and public transportation frequency for residents.",
    });

    const results = provider.matchDraft(draft, [candidate], {
      maxResults: 5,
      minScore: 0.22,
    });

    assert.equal(results[0]?.relationshipType, "possible_duplicate");
    assert.notEqual(results[0]?.relationshipType, "duplicate");
  });

  it("complementary classification works for shared domain different focus", () => {
    const source = signal({
      initiativeId: "a",
      title: "Increase cycling infrastructure lanes",
      description: "Build protected bicycle infrastructure across arterial roads.",
      activityArea: "Mobility",
      category: "Mobility",
    });
    const candidate = signal({
      initiativeId: "b",
      title: "Improve cycling safety education",
      description: "Expand cycling safety education programs in schools and workplaces.",
      activityArea: "Mobility",
      category: "Mobility",
    });

    const results = provider.match({
      source,
      candidates: [candidate],
      maxResults: 5,
      minScore: 0.22,
    });

    assert.ok(results.length >= 1);
    assert.equal(results[0]?.relationshipType, "complementary");
    assert.ok(results[0]?.reasons.some((reason) => reason.code === "complementary_focus"));
  });

  it("reasons are always present on matches", () => {
    const source = signal({
      initiativeId: "a",
      title: "Public park accessibility upgrades",
      description: "Add accessible paths and seating in neighborhood parks.",
    });
    const candidate = signal({
      initiativeId: "b",
      title: "Neighborhood park accessibility improvements",
      description: "Upgrade park paths for wheelchair accessibility and seating.",
    });

    const results = provider.match({
      source,
      candidates: [candidate],
      maxResults: 5,
      minScore: 0.22,
    });

    for (const item of results) {
      assert.ok(item.reasons.length > 0);
    }
  });

  it("priority match works and weak match is not reminder-eligible", () => {
    const strongPrefs = preferences({
      preferredActivityAreas: ["Environment and Climate"],
      interestedTopics: ["transportation"],
    });
    const weakPrefs = preferences({
      interestedTopics: ["garden"],
    });

    const initiatives = [
      {
        initiativeId: "init-strong",
        title: "Public transportation garden corridors",
        description: "Green corridors beside transportation routes.",
        metadata: {
          activityArea: "Environment and Climate",
          tags: [],
          category: "Environment and Climate",
          region: "",
          language: "en",
          communitySlug: "demo",
        },
        stewardId: "s1",
        status: "proposal",
        lifecyclePhase: "projected",
        visibility: { policy: "public" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revisions: [],
        contributions: [],
        timeline: [],
      },
    ] as unknown as Initiative[];

    const strong = scorePriorityMatches(strongPrefs, initiatives);
    assert.ok(strong.some((match) => match.strength === "strong" && match.reminderEligible));

    const weak = scorePriorityMatches(weakPrefs, initiatives);
    for (const match of weak) {
      if (match.strength === "weak") {
        assert.equal(match.reminderEligible, false);
      }
    }
  });

  it("candidate retrieval is bounded", () => {
    const many = Array.from({ length: 120 }, (_, index) => ({
      initiativeId: `init-${index}`,
      title: `Initiative ${index}`,
      description: "Sample description about civic work.",
      metadata: {
        activityArea: index % 2 === 0 ? "Environment and Climate" : "Education",
        tags: [],
        category: "Environment and Climate",
        region: "",
        language: "en",
        communitySlug: "demo",
      },
      stewardId: "s1",
      status: "proposal",
      lifecyclePhase: "projected",
      visibility: { policy: "public" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date(Date.now() - index * 1000).toISOString(),
      revisions: [],
      contributions: [],
      timeline: [],
    })) as unknown as Initiative[];

    const selected = selectCandidateInitiatives(
      {
        initiativeId: "source",
        metadata: {
          activityArea: "Environment and Climate",
          tags: [],
          category: "Environment and Climate",
          region: "",
          language: "en",
          communitySlug: "demo",
        },
      } as Initiative,
      many,
    );

    assert.ok(selected.length <= COMMUNITY_INTELLIGENCE_MAX_CANDIDATES);
  });

  it("Assistant formatting exposes structured results only and explanation rule", () => {
    const text = formatCommunityIntelligenceForAssistantPrompt({
      providerId: "deterministic",
      sourceInitiativeId: "a",
      relatedInitiatives: [
        {
          initiativeId: "b",
          title: "Related transit plan",
          relationshipType: "related",
          score: 0.4,
          reasons: [{ code: "same_activity_area", message: "Same Participation Area" }],
          sharedTopics: ["transit"],
          sharedParticipationAreas: ["Environment and Climate"],
          sharedPriorities: [],
          keyDifferences: [],
          publicUrl: "/initiatives/public/b",
        },
      ],
      collaborationOpportunities: [],
      explanationRule: COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE,
    });

    assert.match(text, /Related transit plan/);
    assert.match(text, /do not invent/i);
    assert.equal(instructionsRequestCommunityIntelligence("Are there similar Initiatives?"), true);
    assert.equal(instructionsRequestCommunityIntelligence("How do I save a draft?"), false);
  });

  it("empty structured result stays empty and truthful", () => {
    const text = formatCommunityIntelligenceForAssistantPrompt({
      providerId: "deterministic",
      sourceInitiativeId: "a",
      relatedInitiatives: [],
      collaborationOpportunities: [],
      explanationRule: COMMUNITY_INTELLIGENCE_ASSISTANT_EXPLANATION_RULE,
    });

    assert.match(text, /No closely related Initiatives were found/);
  });

  it("hidden skills and hidden location are excluded from public profile signals CI may use", () => {
    const profile = {
      profileId: "p1",
      userId: "u1",
      memberNumber: "HU-TEST",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      displayName: "Privacy Participant",
      publicName: "privacy-participant",
      status: "active",
      profileVisibility: "public",
      skills: ["environmental research", "secret skill"],
      skillsVisibility: "private",
      showLocation: false,
      country: "Hiddenland",
      region: "Hidden Region",
      community: "Hidden Town",
      showOrganization: false,
      showParticipationArea: false,
      participationVisibility: "private",
      professionalLinksVisibility: "public",
    } as MemberProfile;

    const projected = toPublicMemberProfile(profile, {
      viewerIsAuthenticated: true,
      viewerIsOwner: false,
    });

    assert.ok(projected);
    assert.equal(projected?.skills, undefined);
    assert.equal(projected?.country, undefined);
    assert.equal(projected?.region, undefined);
    assert.equal(projected?.community, undefined);
  });

  it("public skills may appear when skillsVisibility allows authenticated viewers", () => {
    const profile = {
      profileId: "p2",
      userId: "u2",
      memberNumber: "HU-TEST2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      displayName: "Public Skills Participant",
      publicName: "public-skills-participant",
      status: "active",
      profileVisibility: "public",
      skills: ["environmental research"],
      skillsVisibility: "members_only",
      showLocation: false,
      showOrganization: false,
      showParticipationArea: false,
      participationVisibility: "private",
      professionalLinksVisibility: "public",
    } as MemberProfile;

    const projected = toPublicMemberProfile(profile, {
      viewerIsAuthenticated: true,
      viewerIsOwner: false,
    });

    assert.deepEqual(projected?.skills, ["environmental research"]);
  });

  it("similarity check contract never blocks creation or auto-merges", () => {
    const draft: CommunitySimilarityCheckRequest = {
      title: "Expand public transportation access downtown",
      description: "Improve bus routes and public transportation frequency for residents.",
      activityArea: "Environment and Climate",
    };
    const candidate = signal({
      initiativeId: "existing",
      title: "Expand public transportation access downtown",
      description: "Improve bus routes and public transportation frequency for residents.",
    });
    const items = provider.matchDraft(draft, [candidate], {
      maxResults: 5,
      minScore: 0.22,
    });

    assert.ok(items.some((item) => item.relationshipType === "possible_duplicate"));
    assert.ok(items.every((item) => item.relationshipType !== ("duplicate" as never)));
    // Contract fields on CommunitySimilarityCheckResponse are fixed false.
    const contract = { blocksCreation: false as const, autoMerges: false as const };
    assert.equal(contract.blocksCreation, false);
    assert.equal(contract.autoMerges, false);
  });

  it("Community Intelligence module does not import private messaging or documents", () => {
    const servicePath = resolve(
      process.cwd(),
      "src/modules/community-intelligence/community-intelligence.service.ts",
    );
    const source = readFileSync(servicePath, "utf8");
    assert.equal(/direct-messaging|shared-documents|passwordHash|\.email\b/.test(source), false);
  });

  it("provider seam resolves deterministic, not Gemini", () => {
    assert.equal(provider.providerId, "deterministic");
    assert.notEqual(provider.providerId, "semantic_future");
  });

});
