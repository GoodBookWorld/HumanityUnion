import { Button } from "./Button";

interface ApiUnavailableStateProps {
  title: string;
  explanation: string;
  possibleReason: string;
  retryHref: string;
}

export function ApiUnavailableState({
  title,
  explanation,
  possibleReason,
  retryHref,
}: ApiUnavailableStateProps) {
  return (
    <section className="hu-unavailable" role="alert" aria-live="polite">
      <h1 className="hu-unavailable__title">{title}</h1>
      <p className="hu-unavailable__explanation">{explanation}</p>
      <p className="hu-unavailable__reason">
        <strong>Possible reason:</strong> {possibleReason}
      </p>
      <div className="hu-unavailable__actions">
        <Button href={retryHref} variant="primary">
          Try again
        </Button>
        <Button href="/" variant="secondary">
          Back to Home
        </Button>
      </div>
    </section>
  );
}
