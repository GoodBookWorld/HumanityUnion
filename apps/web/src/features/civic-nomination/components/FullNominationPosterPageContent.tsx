import Link from "next/link";

import type { PublicCivicNominationProjection } from "@hu/types";

import { EXPERTISE_AREA_LABELS, INSTITUTION_ROLE_LABELS, formatCountrySlug } from "../constants";
import { NominationResultWidgetPlaceholder } from "./NominationResultWidgetPlaceholder";
import { NominationVotingWidgetPlaceholder } from "./NominationVotingWidgetPlaceholder";

import "../civic-nomination.css";

interface FullNominationPosterPageContentProps {
  nomination: PublicCivicNominationProjection;
}

function formatStatus(status: PublicCivicNominationProjection["status"]): string {
  return status.replace(/_/g, " ");
}

export function FullNominationPosterPageContent({
  nomination,
}: FullNominationPosterPageContentProps) {
  const displayName = nomination.nomineeDisplayName ?? nomination.nomineeName;

  return (
    <main className="civic-nomination-poster-page">
      <header className="civic-nomination-poster-page__header">
        <p className="civic-nomination-poster-page__eyebrow">
          <Link href="/institutions">Institutions</Link> / Civic Nomination Poster
        </p>
        <h1>{displayName}</h1>
        <dl className="civic-nomination-poster-page__meta">
          <div>
            <dt>Role</dt>
            <dd>{INSTITUTION_ROLE_LABELS[nomination.institutionRole]}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{formatCountrySlug(nomination.countrySlug)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatStatus(nomination.status)}</dd>
          </div>
          <div>
            <dt>Nominated by</dt>
            <dd>{nomination.nominatedByDisplayName}</dd>
          </div>
        </dl>
      </header>

      <section className="civic-nomination-poster-page__section" aria-labelledby="expertise-title">
        <h2 id="expertise-title">Expertise Areas</h2>
        <ul className="civic-nomination-poster-page__tags">
          {nomination.expertiseAreas.map((area) => (
            <li key={area}>{EXPERTISE_AREA_LABELS[area]}</li>
          ))}
        </ul>
      </section>

      <section className="civic-nomination-poster-page__section" aria-labelledby="experience-title">
        <h2 id="experience-title">Experience Summary</h2>
        <p>{nomination.experienceSummary}</p>
      </section>

      <section
        className="civic-nomination-poster-page__section"
        aria-labelledby="achievements-title"
      >
        <h2 id="achievements-title">Confirmed Achievements</h2>
        <p>{nomination.confirmedAchievements}</p>
      </section>

      <section className="civic-nomination-poster-page__section" aria-labelledby="evidence-title">
        <h2 id="evidence-title">Evidence Links</h2>
        {nomination.evidenceLinks.length === 0 ? (
          <p>No evidence links provided.</p>
        ) : (
          <ul className="civic-nomination-poster-page__evidence">
            {nomination.evidenceLinks.map((link) => (
              <li key={`${link.title}-${link.url}`}>
                <a href={link.url} rel="noopener noreferrer" target="same_window">
                  {link.title}
                </a>
                {link.summary ? <p>{link.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="civic-nomination-poster-page__section" aria-labelledby="vision-title">
        <h2 id="vision-title">Vision Statement</h2>
        <p>{nomination.visionStatement}</p>
      </section>

      <section className="civic-nomination-poster-page__section" aria-labelledby="conflict-title">
        <h2 id="conflict-title">Conflict of Interest</h2>
        <p>
          {nomination.conflictOfInterest.status === "none_known"
            ? "No known conflict declared."
            : nomination.conflictOfInterest.summary}
        </p>
      </section>

      <section
        className="civic-nomination-poster-page__section"
        aria-labelledby="declarations-title"
      >
        <h2 id="declarations-title">Declaration Status</h2>
        <ul className="civic-nomination-poster-page__declarations">
          <li>
            Universal Declaration of Human Rights:{" "}
            {nomination.declarationStatus.supportsUdhr ? "Confirmed" : "Not confirmed"}
          </li>
          <li>
            Humanity Union constitutional principles:{" "}
            {nomination.declarationStatus.supportsHumanityUnionPrinciples
              ? "Confirmed"
              : "Not confirmed"}
          </li>
          <li>
            No automatic appointment understood:{" "}
            {nomination.declarationStatus.understandsNoAutomaticAppointment
              ? "Confirmed"
              : "Not confirmed"}
          </li>
          <li>
            Information accuracy confirmed:{" "}
            {nomination.declarationStatus.confirmsAccuracy ? "Confirmed" : "Not confirmed"}
          </li>
        </ul>
      </section>

      <NominationVotingWidgetPlaceholder />
      <NominationResultWidgetPlaceholder transparencyNote={nomination.transparencyNote} />

      <footer className="civic-nomination-poster-page__legal" role="note">
        <p>{nomination.legalNotice}</p>
      </footer>
    </main>
  );
}
