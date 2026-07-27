"use client";

export function NominationVotingWidgetPlaceholder() {
  return (
    <section
      className="civic-nomination-voting-placeholder"
      aria-labelledby="civic-nomination-voting-title"
    >
      <h2 id="civic-nomination-voting-title">Transparent Support Voting</h2>
      <p>
        Registered participants will be able to support, oppose, or abstain when nomination voting
        is enabled.
      </p>
      <div className="civic-nomination-voting-placeholder__controls" aria-disabled="true">
        <button type="button" disabled>
          Support
        </button>
        <button type="button" disabled>
          Oppose
        </button>
        <button type="button" disabled>
          Abstain
        </button>
      </div>
    </section>
  );
}
