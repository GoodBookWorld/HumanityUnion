"use client";

import { usePetitionReadingText } from "../use-petition-reading-text";

interface PetitionReadingTitleProps {
  readonly petitionId: string;
  readonly title: string;
  readonly className?: string;
}

/** A published Petition's title for reading lists; navigation keeps using the petitionId. */
export function PetitionReadingTitle({ petitionId, title, className }: PetitionReadingTitleProps) {
  const reading = usePetitionReadingText({ petitionId, title });

  return (
    <span className={className} lang={reading.lang} dir="auto">
      {reading.title}
    </span>
  );
}
