import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getPublicImplementation } from "../../../../features/implementation/api";

import "./public-implementation-page.css";

interface PublicImplementationPageProps {
  params: Promise<{
    implementationId: string;
  }>;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicImplementationPage({ params }: PublicImplementationPageProps) {
  const { implementationId } = await params;
  let projection = null;

  try {
    projection = await getPublicImplementation(implementationId);
  } catch {
    projection = null;
  }

  if (!projection) {
    return (
      <main className="public-implementation-page">
        <h1>Public Implementation</h1>
        <p>Public implementation record is not available.</p>
        <p className="public-implementation-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  const {
    achievements,
    collectiveDecisionReference,
    collectiveProgress,
    completion,
    currentPhase,
    evidence,
    humanityAssistant,
    implementationCommitmentReference,
    implementationIdentity,
    implementationStatus,
    initiativeContext,
    petitionReference,
    registrationGateway,
    shareReference,
  } = projection;

  const achievementsByPhase = achievements.reduce<Record<string, typeof achievements>>(
    (groups, achievement) => {
      const key = achievement.phaseTitle ?? "Implementation";
      groups[key] = groups[key] ?? [];
      groups[key].push(achievement);
      return groups;
    },
    {},
  );

  return (
    <main className="public-implementation-page">
      <header className="public-implementation-page__header">
        <h1 className="public-implementation-page__title">{implementationIdentity.title}</h1>
        <p className="public-implementation-page__subtitle">Public collective implementation record</p>
      </header>

      <ProfileSection title="Initiative Context">
        <ProfileField label="Initiative" value={initiativeContext.title} />
        <ProfileField label="Summary" value={initiativeContext.summary} />
        <ProfileField
          label="Lifecycle State"
          value={implementationStatus.lifecycleStatusLabel}
        />
        <ProfileField
          label="Recording Status"
          value={implementationIdentity.recordingStatusSummary}
        />
        <p className="public-implementation-page__note">
          Implementation follows prior pipeline stages. This record does not reopen collective
          decision-making or petition endorsement.
        </p>
      </ProfileSection>

      <ProfileSection title="Collective Decision Reference">
        {collectiveDecisionReference.contextAvailable ? (
          <>
            <ProfileField
              label="Collective Decision"
              value={collectiveDecisionReference.collectiveDecisionId}
            />
            <ProfileField
              label="Decision Summary"
              value={collectiveDecisionReference.decisionSummary ?? "Not available"}
            />
            <ProfileField
              label="Approved Result"
              value={collectiveDecisionReference.approvedResultSummary ?? "Not available"}
            />
            <ProfileField
              label="Decision Outcome"
              value={collectiveDecisionReference.approvedOutcomeSummary ?? "Not available"}
            />
          </>
        ) : (
          <p className="public-implementation-page__empty">
            Approved decision context is unavailable.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="Petition Reference">
        {petitionReference.contextAvailable ? (
          <>
            <ProfileField label="Petition" value={petitionReference.petitionId} />
            <ProfileField label="Context" value={petitionReference.summaryStatement} />
            <ProfileField label="Note" value={petitionReference.endorsementContextNote} />
          </>
        ) : (
          <p className="public-implementation-page__empty">Related Petition context is unavailable.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Implementation Commitment Reference">
        {implementationCommitmentReference.contextAvailable ? (
          <>
            <ProfileField
              label="Implementation Commitment"
              value={implementationCommitmentReference.implementationCommitmentId}
            />
            <ProfileField
              label="Summary"
              value={implementationCommitmentReference.summaryStatement}
            />
            <ProfileField label="Note" value={implementationCommitmentReference.contextNote} />
          </>
        ) : (
          <p className="public-implementation-page__empty">
            Implementation Commitment context is unavailable.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="Implementation Status">
        <ProfileField
          label="Lifecycle State"
          value={implementationStatus.lifecycleStatusLabel}
        />
        <ProfileField
          label="Recording Status"
          value={implementationStatus.recordingStatusSummary}
        />
        {implementationStatus.progressClaimsProvisional ? (
          <p className="public-implementation-page__note">
            Public progress claims are provisional during preparatory lifecycle states.
          </p>
        ) : null}
        <ProfileField
          label="Derived Progress Headline"
          value={implementationStatus.derivedProgressHeadline}
        />
        <ProfileField
          label="Derived Completion Headline"
          value={implementationStatus.derivedCompletionHeadline}
        />
      </ProfileSection>

      <ProfileSection title="Collective Progress">
        <p className="public-implementation-page__derived">{collectiveProgress.derivedValueNote}</p>
        {collectiveProgress.totalAchievements === 0 ? (
          <p className="public-implementation-page__empty">
            {implementationStatus.progressClaimsProvisional
              ? "Public progress will appear when collective achievements are recorded during active implementation."
              : "No collective achievements have been publicly recorded for this implementation yet."}
          </p>
        ) : (
          <>
            <ProfileField
              label="Progress Headline"
              value={collectiveProgress.progressIndicatorHeadline}
            />
            <ProfileField
              label="Required Milestone Progress"
              value={collectiveProgress.requiredMilestoneProgressLabel}
            />
            <ProfileField label="Summary" value={collectiveProgress.aggregateProgressSummary} />
            <ProfileField
              label="Total Achievements"
              value={String(collectiveProgress.totalAchievements)}
            />
            <ProfileField
              label="Completed Phases"
              value={String(collectiveProgress.completedPhaseCount)}
            />
            <ProfileField
              label="Completed Milestones"
              value={String(collectiveProgress.completedMilestoneCount)}
            />
            <ProfileField
              label="Required Milestones Satisfied"
              value={`${collectiveProgress.requiredMilestonesSatisfiedCount} of ${collectiveProgress.requiredMilestonesTotalCount}`}
            />
            <ProfileField label="Derived At" value={formatDate(collectiveProgress.derivedAt)} />
          </>
        )}
      </ProfileSection>

      <ProfileSection title="Current Phase">
        {currentPhase.currentPhase ? (
          <>
            <ProfileField label="Current Phase" value={currentPhase.currentPhase.title} />
            <ProfileField label="Summary" value={currentPhase.currentPhase.summary} />
            <ProfileField label="Status" value={currentPhase.currentPhase.status} />
          </>
        ) : (
          <p className="public-implementation-page__empty">
            Implementation phases have not yet been configured for this record.
          </p>
        )}
        {currentPhase.completedPhases.length > 0 ? (
          <div className="public-implementation-page__group">
            <p className="public-implementation-page__group-title">Completed phases</p>
            <ul className="public-implementation-page__list">
              {currentPhase.completedPhases.map((phase) => (
                <li key={phase.implementationPhaseId}>
                  {phase.title} — {phase.summary}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {currentPhase.upcomingPhases.length > 1 ? (
          <div className="public-implementation-page__group">
            <p className="public-implementation-page__group-title">Upcoming phases</p>
            <ul className="public-implementation-page__list">
              {currentPhase.upcomingPhases.slice(1).map((phase) => (
                <li key={phase.implementationPhaseId}>
                  {phase.title} — {phase.summary}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Achievements">
        {achievements.length === 0 ? (
          <p className="public-implementation-page__empty">
            No public achievements have been recorded for this implementation yet.
          </p>
        ) : (
          Object.entries(achievementsByPhase).map(([phaseTitle, phaseAchievements]) => (
            <div key={phaseTitle} className="public-implementation-page__group">
              <p className="public-implementation-page__group-title">{phaseTitle}</p>
              <ul className="public-implementation-page__list">
                {phaseAchievements.map((achievement) => (
                  <li key={achievement.achievementId}>
                    <strong>{achievement.title}</strong> — {achievement.summary}
                    <br />
                    Milestone: {achievement.milestoneTitle} · Recorded:{" "}
                    {formatDate(achievement.recordedAt)}
                    {achievement.evidenceAvailable ? " · Evidence available" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </ProfileSection>

      <ProfileSection title="Evidence">
        {evidence.length === 0 ? (
          <p className="public-implementation-page__empty">
            {achievements.length > 0
              ? "Achievements are recorded. Public supporting material may appear when attached and approved for display."
              : "No public evidence has been attached to recorded achievements."}
          </p>
        ) : (
          <ul className="public-implementation-page__list">
            {evidence.map((entry) => (
              <li key={entry.evidenceId}>
                <strong>{entry.label}</strong> ({entry.evidenceKind}) — Achievement:{" "}
                {entry.achievementTitle}
                {entry.referenceDisplayLabel ? ` · ${entry.referenceDisplayLabel}` : ""}
                {entry.linkDisplayLabel ? ` · ${entry.linkDisplayLabel}` : ""}
                {entry.attachmentDisplayLabel ? ` · ${entry.attachmentDisplayLabel}` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="public-implementation-page__note">
          Evidence supports transparency. It does not establish objective truth.
        </p>
      </ProfileSection>

      <ProfileSection title="Completion Assessment">
        <p className="public-implementation-page__derived">{completion.derivedValueNote}</p>
        {implementationStatus.progressClaimsProvisional ? (
          <p className="public-implementation-page__empty">
            Public completion assessment will appear when implementation recording is active.
          </p>
        ) : (
          <>
            <ProfileField
              label="Completion Reached"
              value={completion.completionReached ? "Yes" : "Not yet"}
            />
            <ProfileField label="Completion Headline" value={completion.completionHeadline} />
            <ProfileField
              label="Required Criteria Progress"
              value={completion.requiredCriteriaProgressLabel}
            />
            <ProfileField label="Assessment Explanation" value={completion.assessmentExplanation} />
            <ProfileField label="Completion Explanation" value={completion.explanation} />
            <ProfileField
              label="Required Milestones Satisfied"
              value={`${completion.satisfiedRequiredMilestoneCount} of ${completion.totalRequiredMilestoneCount}`}
            />
            {completion.remainingRequiredMilestoneDescriptions.length > 0 ? (
              <>
                <p className="public-implementation-page__note">Remaining required milestones:</p>
                <ul className="public-implementation-page__list">
                  {completion.remainingRequiredMilestoneDescriptions.map((description) => (
                    <li key={description}>{description}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="public-implementation-page__note">{completion.notReapprovalStatement}</p>
          </>
        )}
      </ProfileSection>

      <ProfileSection title="Share Link">
        {shareReference.available && shareReference.url ? (
          <>
            <ProfileField label="Public URL" value={shareReference.url} />
            <p className="public-implementation-page__note">{shareReference.sharingNote}</p>
          </>
        ) : (
          <p className="public-implementation-page__empty">Share link is not yet available.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Registration Gateway">
        <ProfileField label="Entry Intent" value={registrationGateway.entryIntent} />
        <p className="public-implementation-page__message">
          {registrationGateway.registrationGatewayMessage}
        </p>
        <ProfileField label="Viewing" value={registrationGateway.viewingNote} />
        <ProfileField label="Sharing" value={registrationGateway.sharingNote} />
        <ProfileField
          label="Registration Required For Recording"
          value={registrationGateway.registrationRequired ? "Yes" : "No"}
        />
        <ProfileField
          label="Recording Available"
          value={registrationGateway.declarationAvailable ? "Yes" : "No"}
        />
        {registrationGateway.declarationAvailable ? (
          <p className="public-implementation-page__action">
            <Link href={registrationGateway.workspacePath}>
              Continue to Implementation Workspace after registration
            </Link>
          </p>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Humanity Assistant">
        <p className="public-implementation-page__message">{humanityAssistant.summary}</p>
        <ProfileField label="Progress" value={humanityAssistant.progressExplanation} />
        <ProfileField label="Achievements" value={humanityAssistant.achievementExplanation} />
        <ProfileField label="Evidence" value={humanityAssistant.evidenceExplanation} />
        <ProfileField label="Completion" value={humanityAssistant.completionExplanation} />
        <p className="public-implementation-page__note">{humanityAssistant.boundaryStatement}</p>
      </ProfileSection>

      <nav className="public-implementation-page__related" aria-label="Related public records">
        <Link href={`/initiatives/public/${encodeURIComponent(initiativeContext.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link
          href={`/collective-decisions/public/${encodeURIComponent(collectiveDecisionReference.collectiveDecisionId)}`}
        >
          View Public Collective Decision
        </Link>
        <Link href={`/petitions/public/${encodeURIComponent(petitionReference.petitionId)}`}>
          View Public Petition
        </Link>
        <Link
          href={`/implementation-commitments/public/${encodeURIComponent(implementationCommitmentReference.implementationCommitmentId)}`}
        >
          View Public Implementation Commitment
        </Link>
        <span>Future Public Impact (not yet active)</span>
      </nav>

      <p className="public-implementation-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
