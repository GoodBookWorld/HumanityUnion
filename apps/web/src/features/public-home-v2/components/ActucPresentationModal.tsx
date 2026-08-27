"use client";

import { useEffect, useId, useRef } from "react";

import { trapTabKey } from "../../../design-system/focus-trap";
import { Button } from "../../../design-system";

import "./actuc-home.css";

export const ACTUC_EXTERNAL_URL = "https://actuc.com/";

interface ActucPresentationModalProps {
  open: boolean;
  onClose: () => void;
}

const PILLARS = [
  {
    node: "[ NODE 01 // THE SHIELD ]",
    title: "Observation & Truth",
    description:
      "Identifying and analyzing global disinformation attacks at the root before they trigger hostility or social collapse.",
  },
  {
    node: "[ NODE 02 // THE SWORD ]",
    title: "Strategy & Counter-Action",
    description:
      "Replacing isolated, passive panic with a synchronized, expert-led intellectual response system.",
  },
  {
    node: "[ NODE 03 // THE SENTINEL ]",
    title: "Hostage to Sentinel",
    description:
      "Empowering individuals to transition from passive spectators of chaos into active guardians of global intelligence.",
  },
] as const;

/**
 * Pack 24C — ACTUC presentation dialog.
 * Reuses HU focus-trap / Escape / backdrop patterns (same contract as PWA install help).
 */
export function ActucPresentationModal({ open, onClose }: ActucPresentationModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

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
    <div className="actuc-modal" role="presentation">
      <button
        type="button"
        className="actuc-modal__backdrop"
        aria-label="Close ACTUC presentation"
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
            Humanity Union // Intellectual Defense Division
          </span>
          <Button type="button" variant="secondary" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>

        <h2 id={titleId} className="actuc-modal__title">
          ACTUC: The Intellectual Army <span>Fighting Ignorance</span>
        </h2>

        <p className="actuc-modal__subtitle">
          Aggression is merely the violent shadow of systemic ignorance.{" "}
          <strong>ACTUC (Action Unity Center)</strong> is Humanity Union&apos;s strategic defense
          platform—mobilizing a global intellectual vanguard to neutralize disinformation, expose
          root causes, and restore human truth.
        </p>

        <div className="actuc-modal__pillars">
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className="actuc-modal__pillar">
              <p className="actuc-modal__pillar-node">{pillar.node}</p>
              <h3 className="actuc-modal__pillar-title">{pillar.title}</h3>
              <p className="actuc-modal__pillar-desc">{pillar.description}</p>
            </article>
          ))}
        </div>

        <div className="actuc-modal__footer">
          <p className="actuc-modal__motto">
            {"> STATUS: "}
            <strong>ACTIVE DEFENSE</strong>
            {" // SLOGAN: "}
            <strong>NEUTRALIZE IGNORANCE. DISARM AGGRESSION.</strong>
          </p>
          <a
            className="actuc-modal__cta"
            href={ACTUC_EXTERNAL_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            [ Join The Vanguard ]
          </a>
        </div>
      </div>
    </div>
  );
}
