interface PublicNewsAiSummaryProps {
  bullets: string[];
}

export function PublicNewsAiSummary({ bullets }: PublicNewsAiSummaryProps) {
  if (bullets.length === 0) {
    return null;
  }

  return (
    <section className="public-news-card__ai-summary" aria-label="AI summary">
      <ul className="public-news-card__ai-summary-list">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}
