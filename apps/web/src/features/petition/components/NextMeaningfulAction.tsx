import type { Petition } from "@hu/types";

import { BOOTSTRAP_PARTICIPANT_ID, deriveNextMeaningfulAction } from "../petition-utils";

interface NextMeaningfulActionProps {
  petition: Petition;
}

export function NextMeaningfulAction({ petition }: NextMeaningfulActionProps) {
  const action = deriveNextMeaningfulAction(petition, BOOTSTRAP_PARTICIPANT_ID);

  return (
    <div className="next-meaningful-action">
      <p className="next-meaningful-action__title">{action.title}</p>
      <p className="next-meaningful-action__detail">{action.detail}</p>
    </div>
  );
}
