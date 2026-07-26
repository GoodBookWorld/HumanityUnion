export function explainPublishInitiative(): string {
  return "An initiative must be published before collaborative analysis can begin in the civic pipeline.";
}

export function explainBeginAnalysis(): string {
  return "Collaborative analysis documents evidence and reasoning before improvement proposals are submitted.";
}

export function explainCreateProposal(): string {
  return "Improvement proposals translate analysis findings into concrete changes for steward review.";
}

export function explainOpenRevision(): string {
  return "Accepted proposals are incorporated through a published initiative revision.";
}

export function explainPrepareDecisionSession(): string {
  return "A decision session packages the civic question after the initiative revision is published.";
}

export function explainCreateCollectiveDecision(): string {
  return "You can create a Collective Decision because the Decision Session has already closed.";
}

export function explainCastVote(): string {
  return "Registered participants with a matching declared Participation Area may cast one vote while a decision is open.";
}

export function explainGenerateCap(): string {
  return "A Civic Action Package summarizes the closed collective decision for external delivery.";
}

export function explainDeliverCap(): string {
  return "Delivery records how the Civic Action Package was sent to recipients.";
}

export function explainRecordOfficialResponse(): string {
  return "Official responses document institutional replies after delivery.";
}

export function explainContinueAccountability(): string {
  return "Accountability timelines track follow-up after an official response is recorded.";
}

export function explainCreatePublicImpact(): string {
  return "Public impact records verified outcomes after implementation tracking completes.";
}

export function explainArchiveInitiative(): string {
  return "The civic archive preserves lessons learned after public impact is verified.";
}

export function explainNotSteward(): string {
  return "Only the initiative steward can advance steward-controlled civic pipeline steps.";
}

export function explainPendingParticipationTransition(): string {
  return "A pending Participation Area transition does not change eligibility until it becomes effective.";
}

export function explainDecisionSessionOpen(): string {
  return "The Decision Session must close before a Collective Decision can be created.";
}

export function explainCollectiveDecisionNotClosed(): string {
  return "The Collective Decision must close before a Civic Action Package can be generated.";
}

export function explainTrackingIncomplete(): string {
  return "Implementation tracking must reach a completed state before public impact can be published.";
}

export function explainNoParticipationArea(): string {
  return "Declare a Participation Area before participating in scoped collective decisions.";
}

export function explainSectionFocus(section: string): string {
  return `Recommendations for the ${section} workspace section are based on your current civic records only.`;
}
