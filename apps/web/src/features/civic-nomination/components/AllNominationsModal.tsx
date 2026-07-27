"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { CivicNominationInstitutionRole } from "@hu/types";

import { Button } from "../../../design-system";
import { listPublicCivicNominations } from "../api";
import { INSTITUTION_ROLE_LABELS, NOMINATABLE_INSTITUTION_ROLES } from "../constants";
import { CompactNominationPoster } from "./CompactNominationPoster";

import "../civic-nomination.css";

interface AllNominationsModalProps {
  defaultRole?: CivicNominationInstitutionRole;
  isOpen: boolean;
  onClose: () => void;
}

export function AllNominationsModal({ defaultRole, isOpen, onClose }: AllNominationsModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [roleFilter, setRoleFilter] = useState<CivicNominationInstitutionRole | "">(
    defaultRole ?? "",
  );
  const [countryFilter, setCountryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nominations, setNominations] = useState<
    Awaited<ReturnType<typeof listPublicCivicNominations>>
  >([]);

  const loadNominations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await listPublicCivicNominations({
        institutionRole: roleFilter || undefined,
        countrySlug: countryFilter || undefined,
      });

      setNominations(
        results.sort((left, right) => {
          const leftDate = left.publishedAt ?? left.updatedAt;
          const rightDate = right.publishedAt ?? right.updatedAt;
          return rightDate.localeCompare(leftDate);
        }),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load civic nominations.",
      );
      setNominations([]);
    } finally {
      setLoading(false);
    }
  }, [countryFilter, roleFilter]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setRoleFilter(defaultRole ?? "");
    void loadNominations();
  }, [defaultRole, isOpen, loadNominations]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="civic-nomination-modal__backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="civic-nomination-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="civic-nomination-modal__header">
          <h2 id={titleId}>All Nominations</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="civic-nomination-modal__close"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="civic-nomination-modal__filters">
          <label className="civic-nomination-form__field">
            <span>Role</span>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as CivicNominationInstitutionRole | "")
              }
            >
              <option value="">All eligible roles</option>
              {NOMINATABLE_INSTITUTION_ROLES.map((role) => (
                <option key={role} value={role}>
                  {INSTITUTION_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>

          <label className="civic-nomination-form__field">
            <span>Country slug</span>
            <input
              type="text"
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              placeholder="e.g. united-states"
            />
          </label>

          <Button type="button" variant="secondary" onClick={() => void loadNominations()}>
            Apply filters
          </Button>
        </div>

        {loading ? <p className="civic-nomination-modal__status">Loading nominations…</p> : null}
        {error ? (
          <p className="civic-nomination-form__error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && nominations.length === 0 ? (
          <p className="civic-nomination-modal__empty">
            No published nominations match these filters yet.
          </p>
        ) : null}

        <div className="civic-nomination-modal__grid">
          {nominations.map((nomination) => (
            <CompactNominationPoster key={nomination.nominationId} nomination={nomination} />
          ))}
        </div>
      </div>
    </div>
  );
}
