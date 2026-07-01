"use client";

import "./analysis-actions.css";

function handlePlaceholderAction(action: string): void {
  console.info(`Collaborative Analysis action placeholder: ${action}`);
}

export function AnalysisActions() {
  return (
    <div className="analysis-actions">
      <button
        type="button"
        className="analysis-actions__button"
        onClick={() => handlePlaceholderAction("add-contribution")}
      >
        Add Contribution
      </button>
      <button
        type="button"
        className="analysis-actions__button"
        onClick={() => handlePlaceholderAction("add-signal")}
      >
        Add Signal
      </button>
      <button
        type="button"
        className="analysis-actions__button analysis-actions__button--secondary"
        onClick={() => {
          document.getElementById("section-progress-policy")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
      >
        View Progress Policy
      </button>
    </div>
  );
}
