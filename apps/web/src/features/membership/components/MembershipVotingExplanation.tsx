import { useTranslations } from "next-intl";

interface MembershipVotingExplanationProps {
  className?: string;
}

/**
 * Closure 06 — transparency note via WEB_UI (`membershipPublic.statistics.votingExplanation`).
 * Canonical English constant remains in @hu/types for non-UI consumers; public chrome must not
 * fall through to the English literal when a catalog value exists.
 */
export function MembershipVotingExplanation({ className }: MembershipVotingExplanationProps) {
  const t = useTranslations("membershipPublic");

  return (
    <p
      className={
        className ? `membership-voting-explanation ${className}` : "membership-voting-explanation"
      }
      role="note"
    >
      {t("statistics.votingExplanation")}
    </p>
  );
}
