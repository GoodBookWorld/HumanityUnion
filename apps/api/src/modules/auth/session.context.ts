import type { AuthIdentity } from "@hu/types";

import { getCurrentAuthIdentity } from "./auth.identity.js";

export interface SessionContext {
  getCurrentIdentity(): AuthIdentity;
}

export const bootstrapSessionContext: SessionContext = {
  getCurrentIdentity() {
    return getCurrentAuthIdentity();
  },
};
