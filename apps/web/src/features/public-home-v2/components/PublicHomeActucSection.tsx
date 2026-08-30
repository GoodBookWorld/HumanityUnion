"use client";

import { useId, useState } from "react";

import { actucAudiowide } from "../actuc-audiowide";
import { ActucPresentationModal } from "./ActucPresentationModal";

import "./actuc-home.css";

/**
 * Pack 24C — compact ACTUC Home presentation section.
 * Placed after Civic Archive. Opens presentation modal via division badge button.
 */
export function PublicHomeActucSection() {
  const titleId = useId();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section
      className={`public-home-v2__section public-home-v2__section--resource public-home-v2__section--actuc ${actucAudiowide.variable}`}
      aria-labelledby={titleId}
    >
      <div className="actuc-home">
        <div className="actuc-home__row">
          <div className="actuc-home__identity">
            <div className="actuc-home__brand">
              <img
                className="actuc-home__logo"
                src="/illustrations/logo-actuc.webp"
                alt=""
                width={48}
                height={48}
                decoding="async"
              />
              <img
                className="actuc-home__name"
                src="/illustrations/actuc.webp"
                alt=""
                width={160}
                height={40}
                decoding="async"
              />
            </div>
            <p id={titleId} className={`actuc-home__slogan ${actucAudiowide.className}`}>
              Action Unity Center
            </p>
          </div>

          <button
            type="button"
            className="actuc-home__badge"
            aria-haspopup="dialog"
            aria-expanded={modalOpen}
            onClick={() => setModalOpen(true)}
          >
            <span className="actuc-home__badge-dot" aria-hidden="true" />
            <span>Humanity Union // Intellectual Defense Division</span>
          </button>
        </div>
      </div>

      <ActucPresentationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}
