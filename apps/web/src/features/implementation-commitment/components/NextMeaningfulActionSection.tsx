import type { ImplementationCommitment } from "@hu/types";

import { BOOTSTRAP_PARTICIPANT_ID, deriveNextMeaningfulAction } from "../commitment-utils";

interface NextMeaningfulActionSectionProps {
  commitment: ImplementationCommitment;
}

export function NextMeaningfulActionSection({ commitment }: NextMeaningfulActionSectionProps) {
  const action = deriveNextMeaningfulAction(commitment, BOOTSTRAP_PARTICIPANT_ID);

  return (
    <div className="next-meaningful-action">
      <p className="next-meaningful-action__title">{action.title}</p>
      <p className="next-meaningful-action__detail">{action.detail}</p>
    </div>
  );
}
