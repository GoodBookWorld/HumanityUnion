import { Button } from "./Button";

interface ApiUnavailableStateProps {
  title: string;
  explanation: string;
  possibleReason?: string;
  retryHref: string;
  retryLabel?: string;
  homeLabel?: string;
}

export function ApiUnavailableState({
  title,
  explanation,
  possibleReason,
  retryHref,
  retryLabel = "Try again",
  homeLabel = "Back to Home",
}: ApiUnavailableStateProps) {
  return (
    <section className="hu-unavailable" role="alert" aria-live="polite">
      <h1 className="hu-unavailable__title">{title}</h1>
      <p className="hu-unavailable__explanation">{explanation}</p>
      {possibleReason ? (
        <p className="hu-unavailable__reason">
          <strong>Possible reason:</strong> {possibleReason}
        </p>
      ) : null}
      <div className="hu-unavailable__actions">
        <Button href={retryHref} variant="primary">
          {retryLabel}
        </Button>
        <Button href="/" variant="secondary">
          {homeLabel}
        </Button>
      </div>
    </section>
  );
}
