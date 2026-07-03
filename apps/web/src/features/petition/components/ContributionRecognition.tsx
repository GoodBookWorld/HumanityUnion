interface ContributionRecognitionProps {
  visible: boolean;
}

export function ContributionRecognition({ visible }: ContributionRecognitionProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="contribution-recognition" aria-live="polite">
      <p>Your signature has been recorded.</p>
      <p>Your participation contributes to public support.</p>
      <p>Thank you for supporting this Petition.</p>
    </div>
  );
}
