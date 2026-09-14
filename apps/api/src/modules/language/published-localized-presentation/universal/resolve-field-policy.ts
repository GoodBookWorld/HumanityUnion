import type { PlpFieldPolicyMap } from "@hu/types";

import { getPlpDomainAdapter } from "./domain-adapter-registry.js";

/** Lookup adapter field policy for entity type (empty when unregistered). */
export function resolveFieldPolicyForEntityType(
  entityType: string,
): PlpFieldPolicyMap {
  const adapter = getPlpDomainAdapter(entityType);
  if (!adapter) {
    return {};
  }
  return adapter.fieldPolicyFor(entityType);
}
