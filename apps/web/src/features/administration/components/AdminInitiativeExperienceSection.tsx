"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminInitiativeExperienceView, AdminPublicChoiceDetail } from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { PublicInitiativeExperiencePage } from "../../public-initiative-experience/components/PublicInitiativeExperiencePage";
import type { AdminReadOnlyElectionBallot } from "../../public-initiative-experience/components/AdminReadOnlyElectionBallot";
import { getAdminPublicChoiceDetail } from "../admin-public-choice-api";
import { getAdminInitiativeExperience } from "../admin-initiative-directory-api";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-initiatives.css";
import "../../public-initiative-experience/public-initiative-experience.css";

interface AdminInitiativeExperienceSectionProps {
  initiativeId: string;
}

function ballotFromAdminDetail(
  detail: AdminPublicChoiceDetail | null,
  unavailable: boolean,
): AdminReadOnlyElectionBallot {
  if (!detail) {
    return {
      electionTitle: "",
      ballotMode: "",
      votingStatus: "",
      decisionId: null,
      effectiveVoterCount: null,
      candidates: [],
      unavailable,
    };
  }

  return {
    electionTitle: detail.electionTitle,
    ballotMode: detail.resultSummary.ballotMode,
    votingStatus: detail.votingStatus,
    decisionId: detail.decisionId,
    effectiveVoterCount: detail.effectiveVoterCount,
    unavailable: false,
    candidates: detail.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      name: candidate.name,
      ...(candidate.photoUrl ? { photoUrl: candidate.photoUrl } : {}),
      ...(candidate.campaignPageUrl ? { campaignPageUrl: candidate.campaignPageUrl } : {}),
      voteCount: candidate.voteCount,
      isBlocked: candidate.isBlocked,
      blockLabel: candidate.blockLabel,
    })),
  };
}

export function AdminInitiativeExperienceSection({
  initiativeId,
}: AdminInitiativeExperienceSectionProps) {
  const [view, setView] = useState<AdminInitiativeExperienceView | null>(null);
  const [election, setElection] = useState<AdminReadOnlyElectionBallot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDenied(false);

    try {
      const experience = await getAdminInitiativeExperience(initiativeId);
      const isPublicChoice =
        resolveInitiativeLifecycleProfile(experience.experience.lifecycleProfile) ===
        "PUBLIC_CHOICE";
      let ballot: AdminReadOnlyElectionBallot | null = null;
      if (isPublicChoice) {
        try {
          const detail = await getAdminPublicChoiceDetail(initiativeId);
          ballot = ballotFromAdminDetail(detail, false);
        } catch {
          ballot = ballotFromAdminDetail(null, true);
        }
      }
      setView(experience);
      setElection(ballot);
    } catch (loadError: unknown) {
      setView(null);
      setElection(null);
      if (isForbiddenError(loadError)) {
        setDenied(true);
        setError("Initiative view requires an Administrator account.");
      } else {
        setError(formatAuthFormError(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showReason = Boolean(view?.administrativelyBlocked || view?.administrativeBlockReason);

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <p className="hu-caption admin-panel__note">
        <Link className="admin-panel__link" href="/admin/initiatives">
          ← Initiative directory
        </Link>
        {" · "}
        <Link
          className="admin-panel__link"
          href={`/admin/initiatives/${encodeURIComponent(initiativeId)}`}
        >
          Inspect record
        </Link>
      </p>

      {loading ? <p className="hu-body">Loading Initiative…</p> : null}
      {error ? (
        <StatusBanner
          title={denied ? "Access restricted" : "Initiative unavailable"}
          message={error}
        />
      ) : null}

      {view && showReason ? (
        <section aria-label="Administrative block reason">
          <h2 className="hu-heading">Administrative block reason</h2>
          <p className="admin-initiative-block-reason">
            {view.administrativeBlockReason ?? "No reason was recorded."}
          </p>
        </section>
      ) : null}

      {view ? (
        <PublicInitiativeExperiencePage
          experience={view.experience}
          readOnly
          readOnlyElection={election}
        />
      ) : null}
    </div>
  );
}
