"use client";

import { MembershipPlatformStatisticsSection } from "../../membership/components/MembershipPlatformStatisticsSection";

interface NominationResultWidgetPlaceholderProps {
  transparencyNote?: string;
}

export function NominationResultWidgetPlaceholder({
  transparencyNote,
}: NominationResultWidgetPlaceholderProps) {
  return (
    <section
      className="civic-nomination-result-placeholder"
      aria-labelledby="civic-nomination-result-title"
    >
      <h2 id="civic-nomination-result-title">Vote Results</h2>
      <p>
        Verified and unverified votes will be shown separately for transparency. They will not
        change vote weight.
      </p>
      <dl className="civic-nomination-result-placeholder__metrics">
        <div>
          <dt>Total support votes</dt>
          <dd>Coming soon</dd>
        </div>
        <div>
          <dt>Verified participant votes</dt>
          <dd>Coming soon</dd>
        </div>
        <div>
          <dt>Unverified participant votes</dt>
          <dd>Coming soon</dd>
        </div>
      </dl>
      {transparencyNote ? (
        <p className="civic-nomination-result-placeholder__note">{transparencyNote}</p>
      ) : null}
      <MembershipPlatformStatisticsSection title="Participation composition" />
    </section>
  );
}
