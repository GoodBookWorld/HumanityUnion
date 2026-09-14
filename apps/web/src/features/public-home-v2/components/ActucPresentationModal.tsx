"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { trapTabKey } from "../../../design-system/focus-trap";
import { Button } from "../../../design-system";
import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import "./actuc-home.css";

export const ACTUC_EXTERNAL_URL = "https://actuc.com/";

interface ActucPresentationModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Pack 24C / 08K.3 — ACTUC presentation dialog.
 * Participant-facing chrome + marketing copy: next-intl (`actuc`).
 * Brand site name: Brand Localization (`useLocalizedBrand`).
 * External URL: protected identity (not translated).
 */
export function ActucPresentationModal({ open, onClose }: ActucPresentationModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const t = useTranslations("actuc");
  const brand = useLocalizedBrand();
  const siteName = brand.siteName;

  const pillars = useMemo(
    () =>
      (
        [
          "shield",
          "sword",
          "sentinel",
        ] as const
      ).map((key) => ({
        key,
        node: t(`pillars.${key}.node`),
        title: t(`pillars.${key}.title`),
        description: t(`pillars.${key}.description`),
      })),
    [t],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    dialog?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (dialog) {
        trapTabKey(event, dialog);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="actuc-modal" role="presentation" data-hu-surface="actuc-modal">
      <button
        type="button"
        className="actuc-modal__backdrop"
        aria-label={t("closePresentationAria")}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="actuc-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="actuc-modal__chrome">
          <span className="actuc-modal__badge" aria-hidden="true">
            <span className="actuc-modal__status-dot" />
            {t("badge", { siteName })}
          </span>
          <Button type="button" variant="secondary" onClick={onClose} aria-label={t("closeAria")}>
            {t("close")}
          </Button>
        </div>

        <h2 id={titleId} className="actuc-modal__title">
          {t("titleLead")} <span>{t("titleEmphasis")}</span>
        </h2>

        <p className="actuc-modal__subtitle">
          {t("subtitleLead")} {t("subtitleBody", { siteName })}
        </p>

        <div className="actuc-modal__pillars">
          {pillars.map((pillar) => (
            <article key={pillar.key} className="actuc-modal__pillar">
              <p className="actuc-modal__pillar-node">{pillar.node}</p>
              <h3 className="actuc-modal__pillar-title">{pillar.title}</h3>
              <p className="actuc-modal__pillar-desc">{pillar.description}</p>
            </article>
          ))}
        </div>

        <div className="actuc-modal__footer">
          <p className="actuc-modal__motto">
            {t("mottoStatusLabel")}
            <strong>{t("mottoStatusValue")}</strong>
            {t("mottoSloganLabel")}
            <strong>{t("mottoSloganValue")}</strong>
          </p>
          <a
            className="actuc-modal__cta"
            href={ACTUC_EXTERNAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-hu-semantic="protected"
          >
            {t("cta")}
          </a>
        </div>
      </div>
    </div>
  );
}
