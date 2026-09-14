/**
 * RESET 05B — thin Mongo Initiative source resolve for PLP operator.
 * Identity = Initiative id (sole civic root). Same identity as rail/detail/sidebar.
 */

import type { WorldInitiativeCardProjection } from "@hu/types";
import {
  INITIATIVE_PLP_ENTITY_TYPE,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  resolveInitiativeLifecycleProfile,
  type PlpLocalizableEntityContract,
  type PublicPresentationNode,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { formatPublicGeography } from "../../../shared/format-public-geography.js";
import {
  buildCanonicalInitiativeCardPresentation,
  fingerprintInitiativePlpCanonicalVersion,
} from "../published-localized-presentation/universal/adapters/initiative-lifecycle-adapter.js";
import { collectAutoPaths } from "../published-localized-presentation/presentation-paths.js";
import { machineEligiblePaths } from "../published-localized-presentation/universal/field-authority.js";
import { INITIATIVE_CARD_FIELD_OWNERSHIP } from "@hu/types";

type ThinInitiativeDoc = {
  initiativeId?: string;
  title?: string;
  description?: string;
  status?: string;
  lifecycleProfile?: string;
  updatedAt?: string;
  visibility?: { policy?: string };
  metadata?: {
    activityArea?: string;
    activityAreaOther?: string;
    countrySlug?: string;
    regionSlug?: string;
    communitySlug?: string;
    region?: string;
    communityAssociation?: string;
    imageUrl?: string;
    startDate?: string;
    completionDate?: string;
    participationScope?: string;
  };
};

export type InitiativePlpOperatorSource = {
  readonly FOUND: boolean;
  readonly PUBLIC: boolean;
  readonly initiativeId: string;
  readonly entityType: typeof INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE;
  readonly entityId: string;
  readonly lifecycleProfile: string;
  readonly card: WorldInitiativeCardProjection | null;
  readonly contract: PlpLocalizableEntityContract | null;
  readonly canonicalPresentation: PublicPresentationNode | null;
  readonly canonicalVersion: string | null;
  readonly schemaVersion: typeof PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  readonly autoPaths: readonly { readonly path: string; readonly value: string }[];
  readonly machinePaths: readonly string[];
  readonly fieldOwnership: Readonly<Record<string, string>>;
};

function summarizeText(text: string, maxLength = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatPublicStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildInitiativePlpCardFromThinDoc(
  doc: ThinInitiativeDoc,
): WorldInitiativeCardProjection | null {
  const initiativeId = doc.initiativeId?.trim();
  if (!initiativeId || !doc.title?.trim()) {
    return null;
  }
  const metadata = doc.metadata ?? {};
  const lifecycleProfile = resolveInitiativeLifecycleProfile(doc.lifecycleProfile);
  const isPublicChoice = lifecycleProfile === "PUBLIC_CHOICE";
  const activityArea =
    metadata.activityArea === "Other" && metadata.activityAreaOther
      ? metadata.activityAreaOther
      : metadata.activityArea ?? "";

  return {
    initiativeId,
    title: doc.title.trim(),
    summary: summarizeText(doc.description ?? ""),
    activityArea,
    geographyLabel: formatPublicGeography({
      countryCode: metadata.countrySlug,
      regionCode: metadata.regionSlug,
      communitySlug: metadata.communitySlug,
      regionLabel: metadata.region,
      ...(isPublicChoice
        ? {}
        : { communityAssociation: metadata.communityAssociation }),
    }),
    countryCode: metadata.countrySlug,
    regionCode: metadata.regionSlug,
    communitySlug: metadata.communitySlug,
    imageUrl: metadata.imageUrl,
    startDate: metadata.startDate,
    completionDate: metadata.completionDate,
    publicStatus: formatPublicStatus(doc.status ?? "active"),
    currentStageLabel: formatPublicStatus(doc.status ?? "active"),
    publicInitiativeHref: `/initiatives/public/${encodeURIComponent(initiativeId)}`,
    publishedAt: doc.updatedAt ?? new Date(0).toISOString(),
    lifecycleProfile,
    electionName: isPublicChoice
      ? metadata.communityAssociation?.trim() || undefined
      : undefined,
  };
}

export function buildInitiativePlpContractFromCard(
  card: WorldInitiativeCardProjection,
  locale: string,
): PlpLocalizableEntityContract {
  const presentation = buildCanonicalInitiativeCardPresentation(card);
  return {
    entityType: INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
    entityId: card.initiativeId,
    canonicalVersion: fingerprintInitiativePlpCanonicalVersion(presentation),
    localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    canonicalPresentation: presentation,
    fieldPolicy: { ...INITIATIVE_CARD_FIELD_OWNERSHIP },
    targetLocale: locale,
    contentRevision: 1,
  };
}

/**
 * Thin Mongo lookup — no store hydrate. Read-only findOne.
 */
export async function resolveInitiativePlpOperatorSource(input: {
  readonly initiativeId: string;
  readonly locale: string;
}): Promise<InitiativePlpOperatorSource> {
  const collection = getMongoCollection<ThinInitiativeDoc>(
    MONGO_COLLECTIONS.initiatives,
  );
  const doc = await collection.findOne(
    { initiativeId: input.initiativeId },
    {
      projection: {
        initiativeId: 1,
        title: 1,
        description: 1,
        status: 1,
        lifecycleProfile: 1,
        updatedAt: 1,
        visibility: 1,
        "metadata.activityArea": 1,
        "metadata.activityAreaOther": 1,
        "metadata.countrySlug": 1,
        "metadata.regionSlug": 1,
        "metadata.communitySlug": 1,
        "metadata.region": 1,
        "metadata.communityAssociation": 1,
        "metadata.imageUrl": 1,
        "metadata.startDate": 1,
        "metadata.completionDate": 1,
        "metadata.participationScope": 1,
      },
    },
  );

  const empty = (found: boolean): InitiativePlpOperatorSource => ({
    FOUND: found,
    PUBLIC: false,
    initiativeId: input.initiativeId,
    entityType: INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
    entityId: input.initiativeId,
    lifecycleProfile: "STANDARD",
    card: null,
    contract: null,
    canonicalPresentation: null,
    canonicalVersion: null,
    schemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    autoPaths: [],
    machinePaths: machineEligiblePaths({ ...INITIATIVE_CARD_FIELD_OWNERSHIP }),
    fieldOwnership: { ...INITIATIVE_CARD_FIELD_OWNERSHIP },
  });

  if (!doc) {
    return empty(false);
  }

  const card = buildInitiativePlpCardFromThinDoc(doc);
  if (!card) {
    return empty(true);
  }
  const contract = buildInitiativePlpContractFromCard(card, input.locale);
  const autoPaths = collectAutoPaths(contract.canonicalPresentation).filter((node) =>
    machineEligiblePaths(contract.fieldPolicy).includes(node.path),
  );

  return {
    FOUND: true,
    PUBLIC: doc.visibility?.policy === "public",
    initiativeId: card.initiativeId,
    entityType: INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
    entityId: card.initiativeId,
    lifecycleProfile: String(card.lifecycleProfile ?? "STANDARD"),
    card,
    contract,
    canonicalPresentation: contract.canonicalPresentation,
    canonicalVersion: contract.canonicalVersion,
    schemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    autoPaths,
    machinePaths: machineEligiblePaths(contract.fieldPolicy),
    fieldOwnership: { ...INITIATIVE_CARD_FIELD_OWNERSHIP },
  };
}
