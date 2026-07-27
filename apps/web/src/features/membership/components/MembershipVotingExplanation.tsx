import { MEMBERSHIP_VOTING_EXPLANATION } from "../membership.constants";

interface MembershipVotingExplanationProps {
  className?: string;
}

export function MembershipVotingExplanation({ className }: MembershipVotingExplanationProps) {
  return (
    <p
      className={
        className ? `membership-voting-explanation ${className}` : "membership-voting-explanation"
      }
      role="note"
    >
      {MEMBERSHIP_VOTING_EXPLANATION}
    </p>
  );
}
