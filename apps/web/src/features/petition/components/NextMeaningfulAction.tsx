import type { PublicPetitionRecord } from "@hu/types";

import { deriveNextMeaningfulAction } from "../petition-utils";

interface NextMeaningfulActionProps {
  petition: PublicPetitionRecord;
  viewerHasSigned: boolean;
}

export function NextMeaningfulAction({ petition, viewerHasSigned }: NextMeaningfulActionProps) {
  const action = deriveNextMeaningfulAction(petition, viewerHasSigned);

  return (
    <div className="next-meaningful-action">
      <p className="next-meaningful-action__title">{action.title}</p>
      <p className="next-meaningful-action__detail">{action.detail}</p>
    </div>
  );
}
