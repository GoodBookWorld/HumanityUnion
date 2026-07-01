import type { Initiative } from "@hu/types";

import "./initiative-explorer.css";

interface InitiativeExplorerProps {
  initiatives: Initiative[];
  selectedId: string | null;
  onSelect: (initiativeId: string) => void;
}

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function InitiativeExplorer({ initiatives, selectedId, onSelect }: InitiativeExplorerProps) {
  if (initiatives.length === 0) {
    return <p className="initiative-explorer__empty">No initiatives yet.</p>;
  }

  return (
    <div className="initiative-explorer">
      {initiatives.map((initiative) => {
        const isSelected = initiative.initiativeId === selectedId;

        return (
          <button
            key={initiative.initiativeId}
            type="button"
            className={`initiative-explorer__item${isSelected ? " initiative-explorer__item--selected" : ""}`}
            onClick={() => onSelect(initiative.initiativeId)}
            aria-pressed={isSelected}
          >
            <span className="initiative-explorer__title">{initiative.title}</span>
            <span className="initiative-explorer__meta">
              <span>Status: {initiative.status}</span>
              <span>Steward: {initiative.stewardId}</span>
              <span>Created: {formatCreatedDate(initiative.createdAt)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
