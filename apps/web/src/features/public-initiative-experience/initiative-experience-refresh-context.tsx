"use client";

import { createContext, useCallback, useContext } from "react";

/**
 * Canonical Initiative experience refresh — after Author Publish/Complete,
 * refetch the experience aggregate so lifecycleStages / sidebar update.
 * Never invents local progression overrides.
 */
export interface InitiativeExperienceRefreshApi {
  refresh: () => Promise<void>;
}

const InitiativeExperienceRefreshContext = createContext<InitiativeExperienceRefreshApi | null>(
  null,
);

export const InitiativeExperienceRefreshProvider = InitiativeExperienceRefreshContext.Provider;

export function useInitiativeExperienceRefresh(): InitiativeExperienceRefreshApi | null {
  return useContext(InitiativeExperienceRefreshContext);
}

/** After stage Publish/Complete: reload stage workspace then refresh experience nav. */
export function useAfterLifecyclePublish(loadWorkspace: () => void | Promise<void>): () => void {
  const experienceRefresh = useInitiativeExperienceRefresh();

  return useCallback(() => {
    void (async () => {
      await loadWorkspace();
      await experienceRefresh?.refresh();
    })();
  }, [loadWorkspace, experienceRefresh]);
}
