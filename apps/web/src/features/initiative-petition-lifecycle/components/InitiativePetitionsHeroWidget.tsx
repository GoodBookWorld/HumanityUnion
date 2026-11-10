"use client";

import Image from "next/image";
import { useId, useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

import {
  PETITION_QUERY_PARAM,
  type InitiativePetitionListState,
} from "../petition-viewer-selection";

import "./initiative-petitions-hero-widget.css";

export const PETITION_WIDGET_ICON = "/icons/workspace/petition.png";

export interface InitiativePetitionsHeroWidgetProps {
  readonly list: InitiativePetitionListState;
  /** Validated selection shown in the central viewer, if any. */
  readonly selectedPetitionId: string | null;
  /** Hash of the Petition Lifecycle stage (e.g. `petition`). */
  readonly stageHash: string;
  readonly onSelectPetition: (petitionId: string) => void;
  /** Re-requests the list after a failed load. */
  readonly onRetry?: () => void;
  readonly defaultExpanded?: boolean;
}

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * HU-LC-05C.4C.3C — compact, expandable list of the Initiative's active
 * Petitions in the hero. Choosing one opens it in the existing central
 * Petition viewer; each entry is also a real link (`?petition=…#petition`)
 * so it can be opened in a new tab or shared.
 */
export function InitiativePetitionsHeroWidget({
  list,
  selectedPetitionId,
  stageHash,
  onSelectPetition,
  onRetry,
  defaultExpanded = false,
}: InitiativePetitionsHeroWidgetProps) {
  const t = useTranslations("initiativeExperience");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const baseId = useId();
  const toggleId = `${baseId}-toggle`;
  const panelId = `${baseId}-panel`;
  const petitions = list.status === "ready" ? list.petitions : [];

  return (
    <section className="pie-hero-petitions" aria-labelledby={toggleId}>
      <h2 className="pie-hero-petitions__heading">
        <button
          type="button"
          id={toggleId}
          className="pie-hero-petitions__toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((current) => !current)}
        >
          <Image
            src={PETITION_WIDGET_ICON}
            alt=""
            width={22}
            height={22}
            className="pie-hero-petitions__icon"
          />
          <span className="pie-hero-petitions__title">{t("petitionsWidget.title")}</span>
          {list.status === "ready" ? (
            <>
              <span className="pie-hero-petitions__count" aria-hidden="true">
                {petitions.length}
              </span>
              <span className="hu-visually-hidden">
                {t("petitionsWidget.countAria", { count: petitions.length })}
              </span>
            </>
          ) : null}
          <span className="pie-hero-petitions__chevron" aria-hidden="true" />
        </button>
      </h2>
      <div id={panelId} className="pie-hero-petitions__panel" hidden={!expanded}>
        {list.status === "loading" ? (
          <p className="pie-hero-petitions__note" role="status">
            {t("petitionsWidget.loading")}
          </p>
        ) : list.status === "failed" ? (
          <p className="pie-hero-petitions__note" role="status">
            {t("petitionsWidget.loadFailed")}{" "}
            {onRetry ? (
              <button type="button" className="pie-hero-petitions__retry" onClick={onRetry}>
                {t("author.actions.retry")}
              </button>
            ) : null}
          </p>
        ) : petitions.length === 0 ? (
          <p className="pie-hero-petitions__note">{t("petitionsWidget.empty")}</p>
        ) : (
          <ul className="pie-hero-petitions__list" aria-label={t("petitionsWidget.listAria")}>
            {petitions.map((petition) => (
              <li key={petition.petitionId} className="pie-hero-petitions__item">
                <a
                  className="pie-hero-petitions__link"
                  href={`?${PETITION_QUERY_PARAM}=${encodeURIComponent(petition.petitionId)}#${stageHash}`}
                  aria-current={petition.petitionId === selectedPetitionId ? "true" : undefined}
                  onClick={(event) => {
                    if (isPlainPrimaryClick(event)) {
                      event.preventDefault();
                      onSelectPetition(petition.petitionId);
                    }
                  }}
                >
                  {petition.title}
                </a>
                <span className="pie-hero-petitions__signatures">
                  {t("petitionsWidget.signatures", { count: petition.signatureCount })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
