import type {
  AuthRole,
  CapabilityScope,
  PlatformCapabilityId,
} from "@hu/types";

import { resolveBlogCapabilities } from "../blog/blog-permissions.js";
import {
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationScopeMismatchError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";
import { expandBlogCapabilitiesToPlatformIds } from "./blog-capability-bridge.js";
import {
  capabilityResolutionCacheKey,
  getCapabilityResolutionCache,
} from "./capability-resolution-context.js";
import { collectActivePlatformCapabilityIds } from "./persistence/platform-capability-grant.repository.js";

export interface ResolveCapabilitiesInput {
  readonly participantId: string;
  /** JWT / RequestIdentity role for compatibility mapping. */
  readonly role?: AuthRole;
}

/**
 * Canonical Capability Resolver (Admin Foundation Pack 02).
 *
 * Combines:
 * - Blog capability grants (+ JWT admin/moderator compat via resolveBlogCapabilities)
 * - Generalized platform_capability_grants (dual-read)
 * without replacing domain ownership checks.
 *
 * Existing Blog authorization helpers remain the production Blog path;
 * domains may adopt this resolver incrementally.
 */
export async function resolveParticipantCapabilities(
  input: ResolveCapabilitiesInput,
): Promise<ReadonlySet<PlatformCapabilityId>> {
  if (!input.participantId?.trim()) {
    throw new AdministrationUnauthorizedError("Participant identity is required.");
  }

  const cache = getCapabilityResolutionCache();
  const cacheKey = capabilityResolutionCacheKey(input.participantId, input.role);
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const blogCaps = await resolveBlogCapabilities({
    participantId: input.participantId,
    role: input.role,
  });
  const resolved = expandBlogCapabilitiesToPlatformIds(blogCaps);

  const platformGrantIds = await collectActivePlatformCapabilityIds(input.participantId);
  for (const id of platformGrantIds) {
    resolved.add(id);
  }

  // JWT admin compatibility for non-Blog platform capabilities.
  if (input.role === "admin") {
    resolved.add("platform.admin");
    resolved.add("platform.capability.manage");
    resolved.add("platform.audit.read");
    resolved.add("platform.settings.manage");
    resolved.add("platform.ops.health.read");
    resolved.add("beta.invite.manage");
    resolved.add("institution.moderate");
    resolved.add("safety.review");
  }

  if (input.role === "moderator") {
    // Compatibility: moderator currently maps to Blog editor; also institution.moderate.
    resolved.add("institution.moderate");
  }

  const frozen = resolved as ReadonlySet<PlatformCapabilityId>;
  cache?.set(cacheKey, frozen);
  return frozen;
}

export async function hasCapability(
  input: ResolveCapabilitiesInput & {
    capability: PlatformCapabilityId;
    scope?: CapabilityScope;
  },
): Promise<boolean> {
  if (!isScopeWellFormed(input.scope)) {
    return false;
  }
  const capabilities = await resolveParticipantCapabilities(input);
  return capabilities.has(input.capability);
}

export async function hasAnyCapability(
  input: ResolveCapabilitiesInput & {
    capabilities: readonly PlatformCapabilityId[];
    scope?: CapabilityScope;
  },
): Promise<boolean> {
  if (!isScopeWellFormed(input.scope)) {
    return false;
  }
  const resolved = await resolveParticipantCapabilities(input);
  return input.capabilities.some((capability) => resolved.has(capability));
}

export async function hasAllCapabilities(
  input: ResolveCapabilitiesInput & {
    capabilities: readonly PlatformCapabilityId[];
    scope?: CapabilityScope;
  },
): Promise<boolean> {
  if (!isScopeWellFormed(input.scope)) {
    return false;
  }
  const resolved = await resolveParticipantCapabilities(input);
  return input.capabilities.every((capability) => resolved.has(capability));
}

export async function assertCapability(
  input: ResolveCapabilitiesInput & {
    capability: PlatformCapabilityId;
    scope?: CapabilityScope;
  },
): Promise<void> {
  if (input.scope && !isScopeWellFormed(input.scope)) {
    throw new AdministrationScopeMismatchError(
      `scopeId is required for scopeType ${input.scope.scopeType}.`,
    );
  }
  if (!(await hasCapability(input))) {
    throw new AdministrationInsufficientCapabilityError(input.capability);
  }
}

export async function assertAnyCapability(
  input: ResolveCapabilitiesInput & {
    capabilities: readonly PlatformCapabilityId[];
    scope?: CapabilityScope;
  },
): Promise<void> {
  if (input.scope && !isScopeWellFormed(input.scope)) {
    throw new AdministrationScopeMismatchError(
      `scopeId is required for scopeType ${input.scope.scopeType}.`,
    );
  }
  if (!(await hasAnyCapability(input))) {
    throw new AdministrationForbiddenError(
      `Missing one of required capabilities: ${input.capabilities.join(", ")}.`,
    );
  }
}

/**
 * Scope well-formedness for Pack 02.
 * Existing behavior remains effectively global where no scope is supplied.
 * initiative / institution / surface require scopeId when provided.
 */
function isScopeWellFormed(scope?: CapabilityScope): boolean {
  if (!scope) {
    return true;
  }
  if (scope.scopeType === "global" || scope.scopeType === "blog") {
    return true;
  }
  return typeof scope.scopeId === "string" && scope.scopeId.length > 0;
}
