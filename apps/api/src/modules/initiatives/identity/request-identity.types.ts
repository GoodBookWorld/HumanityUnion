import type { AuthRole } from "@hu/types";

/**
 * Capability 02 request identity boundary for Initiative lifecycle operations.
 * Future auth middleware attaches AuthIdentity; resolver maps to this shape.
 */
export interface RequestIdentity {
  participantId: string;
  displayName?: string;
  role?: AuthRole;
}
