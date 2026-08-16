import { Button } from "../../../design-system";

interface PublicNewsPlaceholderProps {
  variant: "loading" | "empty" | "error" | "no-results";
  onRetry?: () => void;
  message?: string;
}

export function PublicNewsPlaceholder({ variant, onRetry, message }: PublicNewsPlaceholderProps) {
  if (variant === "loading") {
    return (
      <div
        className="public-news-discovery__skeleton-grid"
        role="status"
        aria-label="Loading news discovery articles"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="public-news-discovery__skeleton-card" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className="public-news-discovery__status" role="alert">
        <h3>News discovery is temporarily unavailable</h3>
        <p>We could not load current articles. Please try again shortly.</p>
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  if (variant === "no-results") {
    return (
      <div className="public-news-discovery__placeholder" role="status">
        <h3>No articles match your filters</h3>
        <p>
          {message ??
            "Adjust search or filters to discover more events you can turn into initiatives."}
        </p>
      </div>
    );
  }

  return (
    <div className="public-news-discovery__placeholder" role="status">
      <h3>No current news articles are available</h3>
      <p>
        The live RSS discovery feed has no active articles yet. When staging news refresh is enabled
        (`NEWS_PROVIDER_ENABLED=true`) and approved sources are fetched, articles appear here
        automatically.
      </p>
    </div>
  );
}
