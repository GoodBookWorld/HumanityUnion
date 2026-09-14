/**
 * RESET 04 — universal domain adapter registry.
 *
 * Domains join PLP publication through adapters. The registry/core must not
 * embed RSS, PublicNewsCard, Media Registry, or Media entity ID helpers.
 */

import type {
  PlpFieldPolicyMap,
  PlpLocalizableEntityContract,
  PublicPresentationNode,
  PublishedLocalizedPresentationSeo,
} from "@hu/types";
import { PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION } from "@hu/types";

export type PlpDomainAdapterResolveInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
};

export type PlpDomainAdapter = {
  readonly adapterId: string;
  readonly supportedEntityTypes: readonly string[];
  /**
   * When true, build inventory for collection surfaces must use the same
   * selection authority as the live consumer (RESET 03E.13 lesson).
   */
  readonly usesConsumerIdentityAuthority: boolean;
  resolveCanonicalEntity(
    input: PlpDomainAdapterResolveInput,
  ): Promise<PlpLocalizableEntityContract | null>;
  fingerprintCanonicalVersion(presentation: PublicPresentationNode): string;
  fieldPolicyFor(entityType: string): PlpFieldPolicyMap;
  /** Optional SEO projection from canonical entity. */
  buildSeo?(
    input: PlpDomainAdapterResolveInput & {
      readonly presentation: PublicPresentationNode;
    },
  ): PublishedLocalizedPresentationSeo | undefined;
};

const adaptersById = new Map<string, PlpDomainAdapter>();
const adaptersByEntityType = new Map<string, PlpDomainAdapter>();

export function resetPlpDomainAdapterRegistryForTests(): void {
  adaptersById.clear();
  adaptersByEntityType.clear();
}

export function registerPlpDomainAdapter(adapter: PlpDomainAdapter): void {
  if (adaptersById.has(adapter.adapterId)) {
    throw new Error(`PLP adapter already registered: ${adapter.adapterId}`);
  }
  for (const entityType of adapter.supportedEntityTypes) {
    const existing = adaptersByEntityType.get(entityType);
    if (existing) {
      throw new Error(
        `PLP entityType ${entityType} already owned by adapter ${existing.adapterId}`,
      );
    }
  }
  adaptersById.set(adapter.adapterId, adapter);
  for (const entityType of adapter.supportedEntityTypes) {
    adaptersByEntityType.set(entityType, adapter);
  }
}

export function getPlpDomainAdapter(
  entityType: string,
): PlpDomainAdapter | null {
  return adaptersByEntityType.get(entityType) ?? null;
}

export function listRegisteredPlpDomainAdapters(): readonly PlpDomainAdapter[] {
  return [...adaptersById.values()];
}

export function listRegisteredPlpEntityTypes(): readonly string[] {
  return [...adaptersByEntityType.keys()];
}

export function isPlpEntityTypeRegistered(entityType: string): boolean {
  return adaptersByEntityType.has(entityType);
}

/** Default schema constant — adapters may override per contract. */
export function defaultPlpSchemaVersion(): string {
  return PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION;
}
