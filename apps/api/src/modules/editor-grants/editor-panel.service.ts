import {
  EDITOR_CAPABILITY_LABELS,
  formatModerationBlockLabel,
  resolveEffectiveModerationBlock,
  resolveInitiativeLifecycleProfile,
  type CountryAffiliationEntry,
  type EditorCapabilityId,
  type EditorGeographicScope,
  type EditorViewerProjection,
  type MediaResource,
  type ModerationBlockAuthority,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { listCountryAffiliations } from "../country-affiliation/persistence/country-affiliation.repository.js";
import { getInitiativeById, listInitiatives } from "../initiatives/initiative.store.js";
import { ensureMediaResourcesSeededOnce } from "../media-resources/media-resource.service.js";
import { listMediaResources } from "../media-resources/persistence/media-resource.repository.js";
import { listPublicChoiceCandidatesByInitiative } from "../public-choice-candidate/persistence/public-choice-candidate.repository.js";
import {
  betaAccessCompatibleWithEditorScope,
  countryAffiliationCompatibleWithEditorScope,
  initiativeContentGeography,
  mediaResourceCompatibleWithEditorScope,
} from "./editor-content-geography.js";
import { assertEditorCapability } from "./editor-grant.authorization.js";
import { findEditorGrantByParticipantId } from "./editor-grant.repository.js";
import {
  contentMatchesEditorScope,
  formatEditorGeographicScope,
} from "./editor-grant.scope.js";

export type EditorPanelToolId =
  | "initiatives"
  | "public-choice"
  | "publishing"
  | "media-resources"
  | "country-people"
  | "beta-access";

export interface EditorPanelStatistic {
  readonly toolId: EditorPanelToolId;
  readonly label: string;
  readonly value: number | null;
  readonly unavailableReason?: string;
}

export interface EditorPanelToolDescriptor {
  readonly toolId: EditorPanelToolId;
  readonly capability: EditorCapabilityId;
  readonly label: string;
  readonly mutationSupported: boolean;
  /** Pack 12C — Block/Unblock when moderation capability granted. */
  readonly moderationSupported: boolean;
  readonly unavailableReason?: string;
}

export interface EditorInitiativeRow {
  readonly initiativeId: string;
  readonly title: string;
  readonly status: string;
  readonly geographyLabel: string;
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority: ModerationBlockAuthority | null;
  readonly blockLabel: string | null;
  readonly publicHref: string;
  readonly updatedAt: string;
}

export interface EditorPublicChoiceRow {
  readonly initiativeId: string;
  readonly electionTitle: string;
  readonly votingStatus: string;
  readonly geographyLabel: string;
  readonly candidateCount: number;
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority: ModerationBlockAuthority | null;
  readonly blockLabel: string | null;
  readonly publicHref: string;
  readonly updatedAt: string;
}

export interface EditorPanelPayload {
  readonly editor: EditorViewerProjection;
  readonly displayName: string;
  readonly tools: readonly EditorPanelToolDescriptor[];
  readonly statistics: readonly EditorPanelStatistic[];
}

async function requireActiveEditor(actorUserId: string) {
  if (!actorUserId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(actorUserId);
  if (!user || user.status !== "active") {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const grant = await findEditorGrantByParticipantId(user.memberId);
  if (!grant || grant.status !== "ACTIVE") {
    throw new AdministrationForbiddenError(
      user.role === "admin"
        ? "Editor Panel is available to active Editors only. Use the Admin Panel for administration."
        : "Active Editor access is required.",
    );
  }

  return { user, grant };
}

function toolsForGrant(input: {
  capabilities: readonly EditorCapabilityId[];
  scope: EditorGeographicScope;
}): EditorPanelToolDescriptor[] {
  const tools: EditorPanelToolDescriptor[] = [];
  const caps = new Set(input.capabilities);

  if (caps.has("INITIATIVE_EDIT") || caps.has("INITIATIVE_MODERATE")) {
    tools.push({
      toolId: "initiatives",
      capability: caps.has("INITIATIVE_EDIT") ? "INITIATIVE_EDIT" : "INITIATIVE_MODERATE",
      label: EDITOR_CAPABILITY_LABELS.INITIATIVE_EDIT,
      mutationSupported: caps.has("INITIATIVE_EDIT"),
      moderationSupported: caps.has("INITIATIVE_MODERATE"),
    });
  }
  if (caps.has("PUBLIC_CHOICE_EDIT") || caps.has("PUBLIC_CHOICE_MODERATE")) {
    tools.push({
      toolId: "public-choice",
      capability: caps.has("PUBLIC_CHOICE_EDIT") ? "PUBLIC_CHOICE_EDIT" : "PUBLIC_CHOICE_MODERATE",
      label: EDITOR_CAPABILITY_LABELS.PUBLIC_CHOICE_EDIT,
      mutationSupported: caps.has("PUBLIC_CHOICE_EDIT"),
      moderationSupported: caps.has("PUBLIC_CHOICE_MODERATE"),
    });
  }
  // Production Completion Pack 01 — PUBLISHING_EDIT dual-authorized via BlogCapability bridge.
  if (caps.has("PUBLISHING_EDIT")) {
    tools.push({
      toolId: "publishing",
      capability: "PUBLISHING_EDIT",
      label: EDITOR_CAPABILITY_LABELS.PUBLISHING_EDIT,
      mutationSupported: true,
      moderationSupported: true,
    });
  }
  if (caps.has("MEDIA_RESOURCE_EDIT")) {
    const regionCity = input.scope.level === "REGION" || input.scope.level === "CITY";
    tools.push({
      toolId: "media-resources",
      capability: "MEDIA_RESOURCE_EDIT",
      label: EDITOR_CAPABILITY_LABELS.MEDIA_RESOURCE_EDIT,
      mutationSupported: !regionCity,
      moderationSupported: false,
      ...(regionCity
        ? {
            unavailableReason:
              "Media Resources are WORLD/COUNTRY only. Region/City Editors cannot mutate them safely.",
          }
        : {}),
    });
  }
  if (caps.has("COUNTRY_PEOPLE_EDIT")) {
    const regionCity = input.scope.level === "REGION" || input.scope.level === "CITY";
    tools.push({
      toolId: "country-people",
      capability: "COUNTRY_PEOPLE_EDIT",
      label: EDITOR_CAPABILITY_LABELS.COUNTRY_PEOPLE_EDIT,
      mutationSupported: !regionCity,
      moderationSupported: false,
      ...(regionCity
        ? {
            unavailableReason:
              "Country Team & Partners entries are country-scoped. Region/City Editors cannot mutate them safely.",
          }
        : {}),
    });
  }
  if (caps.has("BETA_ACCESS_EDIT") && betaAccessCompatibleWithEditorScope(input.scope)) {
    tools.push({
      toolId: "beta-access",
      capability: "BETA_ACCESS_EDIT",
      label: EDITOR_CAPABILITY_LABELS.BETA_ACCESS_EDIT,
      mutationSupported: true,
      moderationSupported: false,
    });
  }

  return tools;
}

function initiativeInScope(
  scope: EditorGeographicScope,
  initiative: {
    metadata: {
      countrySlug?: string;
      regionSlug?: string;
      communitySlug?: string;
      region?: string;
    };
  },
): boolean {
  return contentMatchesEditorScope(
    scope,
    initiativeContentGeography({
      countrySlug: initiative.metadata.countrySlug,
      regionSlug: initiative.metadata.regionSlug,
      communitySlug: initiative.metadata.communitySlug,
    }),
  );
}

function geographyLabel(initiative: {
  metadata: {
    countrySlug?: string;
    regionSlug?: string;
    communitySlug?: string;
    region?: string;
  };
}): string {
  const parts = [
    initiative.metadata.countrySlug,
    initiative.metadata.regionSlug ?? initiative.metadata.region,
    initiative.metadata.communitySlug,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" → ") : "Unclassified";
}

export async function getEditorPanel(input: {
  actorUserId: string;
}): Promise<EditorPanelPayload> {
  const { user, grant } = await requireActiveEditor(input.actorUserId);
  const geographicScope = formatEditorGeographicScope(grant.geographicScope);
  const tools = toolsForGrant({
    capabilities: grant.capabilities,
    scope: grant.geographicScope,
  });

  const statistics = await buildEditorStatistics({
    actorUserId: user.userId,
    tools,
  });

  return {
    editor: {
      isEditor: true,
      status: grant.status,
      capabilities: grant.capabilities,
      geographicScope,
    },
    displayName: user.displayName,
    tools,
    statistics,
  };
}

async function buildEditorStatistics(input: {
  actorUserId: string;
  tools: readonly EditorPanelToolDescriptor[];
}): Promise<EditorPanelStatistic[]> {
  const stats: EditorPanelStatistic[] = [];
  const toolById = new Map(input.tools.map((tool) => [tool.toolId, tool]));

  if (toolById.has("initiatives")) {
    const listed = await listEditorInitiatives({
      actorUserId: input.actorUserId,
      limit: 1,
      offset: 0,
    });
    stats.push({
      toolId: "initiatives",
      label: "Initiatives in editing area",
      value: listed.total,
    });
  }

  if (toolById.has("public-choice")) {
    const listed = await listEditorPublicChoice({
      actorUserId: input.actorUserId,
      limit: 1,
      offset: 0,
    });
    stats.push({
      toolId: "public-choice",
      label: "Public Choice elections in editing area",
      value: listed.total,
    });
  }

  if (toolById.has("media-resources")) {
    const tool = toolById.get("media-resources")!;
    if (!tool.mutationSupported) {
      stats.push({
        toolId: "media-resources",
        label: "Media Resources",
        value: null,
        unavailableReason: "Not scoped at this level",
      });
    } else {
      const listed = await listEditorMediaResources({ actorUserId: input.actorUserId });
      stats.push({
        toolId: "media-resources",
        label: "Media Resources in editing area",
        value: listed.length,
      });
    }
  }

  if (toolById.has("country-people")) {
    const tool = toolById.get("country-people")!;
    if (!tool.mutationSupported) {
      stats.push({
        toolId: "country-people",
        label: "Country Team & Partners",
        value: null,
        unavailableReason: "Not scoped at this level",
      });
    } else {
      const listed = await listEditorCountryPeople({ actorUserId: input.actorUserId });
      stats.push({
        toolId: "country-people",
        label: "Team & Partners in editing area",
        value: listed.length,
      });
    }
  }

  return stats;
}

export async function listEditorInitiatives(input: {
  actorUserId: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: EditorInitiativeRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const { grant } = await requireActiveEditor(input.actorUserId);
  const caps = new Set(grant.capabilities);
  if (!caps.has("INITIATIVE_EDIT") && !caps.has("INITIATIVE_MODERATE")) {
    throw new AdministrationInsufficientCapabilityError(
      "INITIATIVE_EDIT",
      "Editor permission INITIATIVE_EDIT or INITIATIVE_MODERATE is required.",
    );
  }

  const all = listInitiatives().filter((initiative) =>
    initiativeInScope(grant.geographicScope, initiative),
  );

  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 25), 1), 100);
  const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
  const page = all
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(offset, offset + limit);

  const items: EditorInitiativeRow[] = page.map((initiative) => {
    const resolved = resolveEffectiveModerationBlock(initiative);
    return {
      initiativeId: initiative.initiativeId,
      title: initiative.title,
      status: String(initiative.status ?? ""),
      geographyLabel: geographyLabel(initiative),
      administrativelyBlocked: resolved.isBlocked,
      blockAuthority: resolved.isBlocked ? resolved.authority : null,
      blockLabel: formatModerationBlockLabel(initiative),
      publicHref: `/initiatives/public/${initiative.initiativeId}`,
      updatedAt: initiative.updatedAt,
    };
  });

  return {
    items,
    total: all.length,
    limit,
    offset,
    hasMore: offset + items.length < all.length,
  };
}

export async function listEditorPublicChoice(input: {
  actorUserId: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: EditorPublicChoiceRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const { grant } = await requireActiveEditor(input.actorUserId);
  const caps = new Set(grant.capabilities);
  if (!caps.has("PUBLIC_CHOICE_EDIT") && !caps.has("PUBLIC_CHOICE_MODERATE")) {
    throw new AdministrationInsufficientCapabilityError(
      "PUBLIC_CHOICE_EDIT",
      "Editor permission PUBLIC_CHOICE_EDIT or PUBLIC_CHOICE_MODERATE is required.",
    );
  }

  const all = listInitiatives().filter(
    (initiative) =>
      resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE" &&
      initiativeInScope(grant.geographicScope, initiative),
  );

  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 25), 1), 100);
  const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
  const page = all
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(offset, offset + limit);

  const items: EditorPublicChoiceRow[] = await Promise.all(
    page.map(async (initiative) => {
      const candidates = await listPublicChoiceCandidatesByInitiative(initiative.initiativeId);
      const resolved = resolveEffectiveModerationBlock(initiative);
      return {
        initiativeId: initiative.initiativeId,
        electionTitle:
          initiative.metadata.communityAssociation?.trim() || initiative.title,
        votingStatus: String(initiative.status ?? ""),
        geographyLabel: geographyLabel(initiative),
        candidateCount: candidates.length,
        administrativelyBlocked: resolved.isBlocked,
        blockAuthority: resolved.isBlocked ? resolved.authority : null,
        blockLabel: formatModerationBlockLabel(initiative),
        publicHref: `/initiatives/public/${initiative.initiativeId}`,
        updatedAt: initiative.updatedAt,
      };
    }),
  );

  return {
    items,
    total: all.length,
    limit,
    offset,
    hasMore: offset + items.length < all.length,
  };
}

export async function listEditorMediaResources(input: {
  actorUserId: string;
}): Promise<MediaResource[]> {
  await assertEditorCapability({
    actorUserId: input.actorUserId,
    capability: "MEDIA_RESOURCE_EDIT",
  });
  const { grant } = await requireActiveEditor(input.actorUserId);

  if (grant.geographicScope.level === "REGION" || grant.geographicScope.level === "CITY") {
    return [];
  }

  await ensureMediaResourcesSeededOnce();
  const all = await listMediaResources({});
  return all.filter((resource) =>
    mediaResourceCompatibleWithEditorScope(grant.geographicScope, resource),
  );
}

export async function listEditorCountryPeople(input: {
  actorUserId: string;
}): Promise<CountryAffiliationEntry[]> {
  await assertEditorCapability({
    actorUserId: input.actorUserId,
    capability: "COUNTRY_PEOPLE_EDIT",
  });
  const { grant } = await requireActiveEditor(input.actorUserId);

  if (grant.geographicScope.level === "REGION" || grant.geographicScope.level === "CITY") {
    return [];
  }

  const all = await listCountryAffiliations({});
  return all.filter((entry) =>
    countryAffiliationCompatibleWithEditorScope(grant.geographicScope, entry.countryCode),
  );
}

export async function assertEditorMayMutatePublicChoiceElection(input: {
  actorUserId: string;
  initiativeId: string;
}): Promise<void> {
  await assertEditorCapability({
    actorUserId: input.actorUserId,
    capability: "PUBLIC_CHOICE_EDIT",
  });
  const { grant } = await requireActiveEditor(input.actorUserId);
  const initiative = getInitiativeById(input.initiativeId);
  if (
    !initiative ||
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE" ||
    !initiativeInScope(grant.geographicScope, initiative)
  ) {
    throw new AdministrationForbiddenError(
      "You do not have Editor permission for this content.",
    );
  }
  const resolved = resolveEffectiveModerationBlock(initiative);
  if (resolved.isBlocked) {
    throw new AdministrationForbiddenError(
      resolved.authority === "ADMIN"
        ? "This content has been blocked by an administrator. Please contact the administrator."
        : "This election has been blocked by an editor.",
    );
  }
}

export async function listEditorPublicChoiceCandidates(input: {
  actorUserId: string;
  initiativeId: string;
}): Promise<{
  initiativeId: string;
  electionTitle: string;
  administrativelyBlocked: boolean;
  blockAuthority: ModerationBlockAuthority | null;
  blockLabel: string | null;
  candidates: Array<{
    candidateId: string;
    name: string;
    photoUrl?: string;
    campaignPageUrl?: string;
    isBlocked: boolean;
    blockAuthority: ModerationBlockAuthority | null;
    blockLabel: string | null;
  }>;
}> {
  const { grant } = await requireActiveEditor(input.actorUserId);
  const caps = new Set(grant.capabilities);
  if (!caps.has("PUBLIC_CHOICE_EDIT") && !caps.has("PUBLIC_CHOICE_MODERATE")) {
    throw new AdministrationInsufficientCapabilityError(
      "PUBLIC_CHOICE_EDIT",
      "Editor permission PUBLIC_CHOICE_EDIT or PUBLIC_CHOICE_MODERATE is required.",
    );
  }

  const initiative = getInitiativeById(input.initiativeId);
  if (
    !initiative ||
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE" ||
    !initiativeInScope(grant.geographicScope, initiative)
  ) {
    throw new AdministrationForbiddenError(
      "You do not have Editor permission for this content.",
    );
  }

  const electionResolved = resolveEffectiveModerationBlock(initiative);
  const candidates = await listPublicChoiceCandidatesByInitiative(input.initiativeId);
  return {
    initiativeId: initiative.initiativeId,
    electionTitle: initiative.metadata.communityAssociation?.trim() || initiative.title,
    administrativelyBlocked: electionResolved.isBlocked,
    blockAuthority: electionResolved.isBlocked ? electionResolved.authority : null,
    blockLabel: formatModerationBlockLabel(initiative),
    candidates: candidates.map((candidate) => {
      const resolved = resolveEffectiveModerationBlock(candidate);
      return {
        candidateId: candidate.candidateId,
        name: candidate.name,
        photoUrl: candidate.photoUrl,
        campaignPageUrl: candidate.campaignPageUrl,
        isBlocked: resolved.isBlocked,
        blockAuthority: resolved.isBlocked ? resolved.authority : null,
        blockLabel: formatModerationBlockLabel(candidate),
      };
    }),
  };
}
