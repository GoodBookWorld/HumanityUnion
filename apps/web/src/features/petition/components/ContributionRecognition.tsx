import { useTranslations } from "next-intl";

const CONTRIBUTION = "author.petition.public.status.contribution";

interface ContributionRecognitionProps {
  visible: boolean;
}

export function ContributionRecognition({ visible }: ContributionRecognitionProps) {
  const t = useTranslations("initiativeExperience");

  if (!visible) {
    return null;
  }

  return (
    <div className="contribution-recognition" aria-live="polite">
      <p>{t(`${CONTRIBUTION}.recorded`)}</p>
      <p>{t(`${CONTRIBUTION}.contributes`)}</p>
      <p>{t(`${CONTRIBUTION}.thanks`)}</p>
    </div>
  );
}
