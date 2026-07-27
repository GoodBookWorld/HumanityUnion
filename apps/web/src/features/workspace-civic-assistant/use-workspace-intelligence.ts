"use client";

import { useEffect, useState } from "react";

import {
  fetchWorkspaceIntelligence,
  type WorkspaceIntelligenceResponse,
} from "./workspace-intelligence-api";

export interface UseWorkspaceIntelligenceInput {
  initiativeId?: string;
  section?: string;
}

export interface UseWorkspaceIntelligenceState {
  intelligence: WorkspaceIntelligenceResponse | null;
  loading: boolean;
  error: string | null;
}

export function useWorkspaceIntelligence(
  input: UseWorkspaceIntelligenceInput,
): UseWorkspaceIntelligenceState {
  const [intelligence, setIntelligence] = useState<WorkspaceIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    void fetchWorkspaceIntelligence({
      initiativeId: input.initiativeId,
      section: input.section,
    })
      .then((response) => {
        if (!cancelled) {
          setIntelligence(response);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setIntelligence(null);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Workspace intelligence request failed.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [input.initiativeId, input.section]);

  return { intelligence, loading, error };
}
