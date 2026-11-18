"use client";

import {
  RRP_APPLICATION_ACTIVE_STATUSES,
  RRP_APPLICATION_CONSENT_VERSION,
  type RrpApplicationDetail,
  type RrpFundingModel,
} from "@hu/types";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { trapTabKey } from "../../../design-system/focus-trap";
import { ApiRequestError, formatAuthFormError } from "../../../lib/api-client";
import { getMyMemberProfile } from "../../member-profile/member-profile-api";
import { CountrySelect } from "../../geography-integrity/CountrySelect";
import {
  createRrpApplicationDraft,
  listMyRrpApplications,
  submitRrpApplication,
  updateRrpApplicationDraft,
  withdrawRrpApplication,
} from "../rrp-application-api";
import {
  EMPTY_RRP_APPLICATION_FORM,
  buildRrpDraftPayload,
  formStateFromRrpApplication,
  isRrpApplicationActiveStatus,
  isRrpApplicationEditableStatus,
  isRrpApplicationFormDirty,
  resolvePrefillResidenceCountryCode,
  validateRrpApplicationFormForSubmit,
  type RrpApplicationFormState,
} from "../rrp-application-form";

import "../../../design-system/components/confirm-dialog.css";
import "./rrp-application-modal.css";

type ModalView = "loading" | "hub" | "form" | "success";
type BusyAction = "save" | "submit" | "withdraw" | "create" | null;
type PendingNavigation = "close" | "hub" | null;

interface RrpApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, open this application after the list loads instead of the hub. */
  initialApplicationId?: string | null;
  /** Prefer the hub create section (used by empty-state “new application”). */
  initialIntent?: "hub" | "create" | null;
  /** Fired after save / submit / withdraw / create so external widgets can refresh. */
  onApplicationsChanged?: () => void;
}

function formatRrpApiError(
  error: unknown,
  t: ReturnType<typeof useTranslations<"rrpApplication">>,
): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) {
      return t("errors.conflict");
    }
    if (error.status === 503) {
      return t("errors.unavailable");
    }
  }
  return formatAuthFormError(error);
}

export function RrpApplicationModal({
  isOpen,
  onClose,
  initialApplicationId = null,
  initialIntent = null,
  onApplicationsChanged,
}: RrpApplicationModalProps) {
  const t = useTranslations("rrpApplication");
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onApplicationsChangedRef = useRef(onApplicationsChanged);
  onApplicationsChangedRef.current = onApplicationsChanged;
  const tRef = useRef(t);
  tRef.current = t;

  const [view, setView] = useState<ModalView>("loading");
  const [applications, setApplications] = useState<RrpApplicationDetail[]>([]);
  const [active, setActive] = useState<RrpApplicationDetail | null>(null);
  const [form, setForm] = useState<RrpApplicationFormState>(EMPTY_RRP_APPLICATION_FORM);
  const [displayNameHint, setDisplayNameHint] = useState<string | null>(null);
  const [newRepresentCountry, setNewRepresentCountry] = useState("");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [baselineForm, setBaselineForm] = useState<RrpApplicationFormState | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);
  const requestCloseRef = useRef<() => void>(() => undefined);
  const discardOpenRef = useRef(false);

  const activeApplications = useMemo(
    () => applications.filter((item) => isRrpApplicationActiveStatus(item.status)),
    [applications],
  );
  const historyApplications = useMemo(
    () => applications.filter((item) => !isRrpApplicationActiveStatus(item.status)),
    [applications],
  );

  const formDirty =
    view === "form" &&
    active !== null &&
    isRrpApplicationEditableStatus(active.status) &&
    isRrpApplicationFormDirty(form, baselineForm);

  function goToHub() {
    setActive(null);
    setBaselineForm(null);
    setView("hub");
    setError(null);
    setDiscardOpen(false);
    setPendingNavigation(null);
  }

  function requestClose() {
    if (formDirty) {
      setPendingNavigation("close");
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  function requestReturnToHub() {
    if (formDirty) {
      setPendingNavigation("hub");
      setDiscardOpen(true);
      return;
    }
    goToHub();
  }

  function confirmDiscard() {
    const next = pendingNavigation;
    setDiscardOpen(false);
    setPendingNavigation(null);
    setBaselineForm(null);
    if (next === "hub") {
      goToHub();
      return;
    }
    onClose();
  }

  requestCloseRef.current = requestClose;
  discardOpenRef.current = discardOpen;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setView("loading");
    setError(null);
    setStatusMessage(null);
    setBusy(null);
    setActive(null);
    setBaselineForm(null);
    setForm(EMPTY_RRP_APPLICATION_FORM);
    setNewRepresentCountry("");
    setDiscardOpen(false);
    setPendingNavigation(null);

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    let cancelled = false;

    void (async () => {
      try {
        const [listed, profile] = await Promise.all([
          listMyRrpApplications(),
          getMyMemberProfile().catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setApplications(listed);
        const residence = resolvePrefillResidenceCountryCode(profile?.country);
        const hint = profile?.displayName?.trim() || null;
        setDisplayNameHint(hint);
        setForm((current) => ({
          ...current,
          residenceCountryCode: residence || current.residenceCountryCode,
        }));

        const selected =
          typeof initialApplicationId === "string" && initialApplicationId.trim().length > 0
            ? listed.find((item) => item.applicationId === initialApplicationId)
            : undefined;

        if (selected) {
          const nextForm = formStateFromRrpApplication(selected);
          setActive(selected);
          setForm(nextForm);
          setBaselineForm(nextForm);
          if (selected.status === "submitted" || selected.status === "under_review") {
            setView("success");
            setStatusMessage(tRef.current(`status.${selected.status}`));
          } else if (
            selected.status === "draft" ||
            selected.status === "information_requested"
          ) {
            setView("form");
          } else {
            setView("success");
            setStatusMessage(tRef.current(`status.${selected.status}`));
          }
        } else {
          setView("hub");
          if (initialIntent === "create") {
            setStatusMessage(tRef.current("hub.newHeading"));
          }
          if (
            typeof initialApplicationId === "string" &&
            initialApplicationId.trim().length > 0 &&
            !selected
          ) {
            setError(tRef.current("errors.notFound"));
          }
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(formatRrpApiError(loadError, tRef.current));
        setView("hub");
      }
    })();

    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea",
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (discardOpenRef.current) {
          return;
        }
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (discardOpenRef.current) {
        return;
      }
      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      const restore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
    // Intentionally omit `t`: next-intl translator identity churn must not
    // remount/reset hub country selection mid-interaction.
  }, [isOpen, initialApplicationId, initialIntent]);

  if (!isOpen) {
    return null;
  }

  function updateField<K extends keyof RrpApplicationFormState>(
    key: K,
    value: RrpApplicationFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openApplication(application: RrpApplicationDetail) {
    const nextForm = formStateFromRrpApplication(application);
    setActive(application);
    setForm(nextForm);
    setBaselineForm(nextForm);
    setError(null);
    setStatusMessage(null);
    setView(application.status === "submitted" || application.status === "under_review"
      ? "success"
      : "form");
    if (application.status === "submitted" || application.status === "under_review") {
      setStatusMessage(t(`status.${application.status}`));
    }
  }

  async function handleCreateDraft() {
    if (busy !== null) {
      return;
    }
    if (!newRepresentCountry.trim()) {
      setError(t("validation.representCountry"));
      return;
    }
    const conflict = activeApplications.find(
      (item) => item.representCountryCode === newRepresentCountry.trim().toUpperCase(),
    );
    if (conflict) {
      setError(t("errors.duplicateActive"));
      return;
    }

    setBusy("create");
    setError(null);
    try {
      const created = await createRrpApplicationDraft({
        representCountryCode: newRepresentCountry,
        residenceCountryCode: form.residenceCountryCode || null,
      });
      setApplications((current) => [created, ...current.filter((item) => item.applicationId !== created.applicationId)]);
      openApplication(created);
      onApplicationsChangedRef.current?.();
    } catch (createError) {
      setError(formatRrpApiError(createError, t));
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveDraft() {
    if (!active || !isRrpApplicationEditableStatus(active.status) || busy !== null) {
      return;
    }
    setBusy("save");
    setError(null);
    setStatusMessage(null);
    try {
      const payload = buildRrpDraftPayload(form);
      const updated = await updateRrpApplicationDraft(active.applicationId, {
        expectedRevision: active.revision,
        ...payload,
      });
      const nextForm = formStateFromRrpApplication(updated);
      setActive(updated);
      setApplications((current) =>
        current.map((item) => (item.applicationId === updated.applicationId ? updated : item)),
      );
      setForm(nextForm);
      setBaselineForm(nextForm);
      setStatusMessage(t("messages.draftSaved"));
      onApplicationsChangedRef.current?.();
    } catch (saveError) {
      setError(formatRrpApiError(saveError, t));
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    if (!active || !isRrpApplicationEditableStatus(active.status)) {
      return;
    }
    const issue = validateRrpApplicationFormForSubmit(form);
    if (issue) {
      setError(t(`validation.${issue}`));
      return;
    }

    setBusy("submit");
    setError(null);
    setStatusMessage(null);
    try {
      const payload = buildRrpDraftPayload(form);
      const saved = await updateRrpApplicationDraft(active.applicationId, {
        expectedRevision: active.revision,
        ...payload,
      });
      const submitted = await submitRrpApplication({
        applicationId: saved.applicationId,
        expectedRevision: saved.revision,
      });
      setActive(submitted);
      setApplications((current) =>
        current.map((item) =>
          item.applicationId === submitted.applicationId ? submitted : item,
        ),
      );
      setBaselineForm(formStateFromRrpApplication(submitted));
      setView("success");
      setStatusMessage(t("messages.submitted"));
      onApplicationsChangedRef.current?.();
    } catch (submitError) {
      setError(formatRrpApiError(submitError, t));
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    if (!active || !RRP_APPLICATION_ACTIVE_STATUSES.includes(active.status)) {
      return;
    }
    setBusy("withdraw");
    setError(null);
    try {
      const withdrawn = await withdrawRrpApplication({
        applicationId: active.applicationId,
        expectedRevision: active.revision,
      });
      setApplications((current) =>
        current.map((item) =>
          item.applicationId === withdrawn.applicationId ? withdrawn : item,
        ),
      );
      setActive(null);
      setView("hub");
      setStatusMessage(t("messages.withdrawn"));
      onApplicationsChangedRef.current?.();
    } catch (withdrawError) {
      setError(formatRrpApiError(withdrawError, t));
    } finally {
      setBusy(null);
    }
  }

  const editable = active ? isRrpApplicationEditableStatus(active.status) : true;

  return (
    <>
    <div
      className="hu-confirm-dialog__backdrop rrp-application-modal__backdrop"
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="hu-confirm-dialog rrp-application-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rrp-application-modal__scroll">
          <header className="rrp-application-modal__header">
            <div>
              <h2 id={titleId} className="rrp-application-modal__title">
                {t("title")}
              </h2>
              <p id={descriptionId} className="rrp-application-modal__intro">
                {t("intro")}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="rrp-application-modal__close"
              aria-label={t("closeAria")}
              onClick={requestClose}
            >
              {t("close")}
            </Button>
          </header>

          {error ? (
            <p className="rrp-application-modal__error" role="alert">
              {error}
            </p>
          ) : null}
          {statusMessage && view !== "success" ? (
            <p className="rrp-application-modal__status" role="status">
              {statusMessage}
            </p>
          ) : null}

          {view === "loading" ? (
            <p className="rrp-application-modal__status" role="status">
              {t("loading")}
            </p>
          ) : null}

          {view === "hub" ? (
            <div className="rrp-application-modal__hub">
              <section>
                <h3>{t("hub.activeHeading")}</h3>
                {activeApplications.length === 0 ? (
                  <p className="rrp-application-modal__hint">{t("hub.noActive")}</p>
                ) : (
                  <ul className="rrp-application-modal__list">
                    {activeApplications.map((item) => (
                      <li key={item.applicationId} className="rrp-application-modal__list-item">
                        <p className="rrp-application-modal__list-meta">
                          {t("hub.countryLabel", { country: item.representCountryCode })} ·{" "}
                          {t(`status.${item.status}`)}
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => openApplication(item)}
                        >
                          {isRrpApplicationEditableStatus(item.status)
                            ? t("hub.resume")
                            : t("hub.view")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3>{t("hub.newHeading")}</h3>
                <CountrySelect
                  id="rrp-new-represent-country"
                  label={t("fields.representCountry")}
                  value={newRepresentCountry}
                  onChange={setNewRepresentCountry}
                  required
                />
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() => void handleCreateDraft()}
                >
                  {busy === "create" ? t("busy.creating") : t("hub.startDraft")}
                </Button>
              </section>

              {historyApplications.length > 0 ? (
                <section>
                  <h3>{t("hub.historyHeading")}</h3>
                  <ul className="rrp-application-modal__list">
                    {historyApplications.map((item) => (
                      <li key={item.applicationId} className="rrp-application-modal__list-item">
                        <p className="rrp-application-modal__list-meta">
                          {t("hub.countryLabel", { country: item.representCountryCode })} ·{" "}
                          {t(`status.${item.status}`)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {view === "form" && active ? (
            <form
              className="rrp-application-modal__form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <p className="rrp-application-modal__hint">
                {t("form.editingCountry", { country: active.representCountryCode })} ·{" "}
                {t(`status.${active.status}`)}
              </p>
              {displayNameHint ? (
                <p className="rrp-application-modal__hint">
                  {t("form.displayNameHint", { name: displayNameHint })}
                </p>
              ) : null}

              <div className="rrp-application-modal__row">
                <label className="rrp-application-modal__field">
                  <span>{t("fields.legalFirstName")}</span>
                  <input
                    name="legalFirstName"
                    autoComplete="given-name"
                    required
                    disabled={!editable || busy !== null}
                    value={form.legalFirstName}
                    onChange={(event) => updateField("legalFirstName", event.target.value)}
                  />
                </label>
                <label className="rrp-application-modal__field">
                  <span>{t("fields.legalLastName")}</span>
                  <input
                    name="legalLastName"
                    autoComplete="family-name"
                    required
                    disabled={!editable || busy !== null}
                    value={form.legalLastName}
                    onChange={(event) => updateField("legalLastName", event.target.value)}
                  />
                </label>
              </div>

              <label className="rrp-application-modal__field">
                <span>{t("fields.profession")}</span>
                <input
                  name="profession"
                  required
                  disabled={!editable || busy !== null}
                  value={form.profession}
                  onChange={(event) => updateField("profession", event.target.value)}
                />
              </label>

              <CountrySelect
                id="rrp-residence-country"
                label={t("fields.residenceCountry")}
                value={form.residenceCountryCode}
                onChange={(code) => updateField("residenceCountryCode", code)}
                required
                disabled={!editable || busy !== null}
              />

              <CountrySelect
                id="rrp-represent-country"
                label={t("fields.representCountry")}
                value={form.representCountryCode}
                onChange={(code) => updateField("representCountryCode", code)}
                required
                disabled={!editable || busy !== null}
                helperText={t("fields.representCountryHelp")}
              />

              <label className="rrp-application-modal__field">
                <span>{t("fields.dateOfBirth")}</span>
                <input
                  name="dateOfBirth"
                  type="date"
                  required
                  autoComplete="bday"
                  disabled={!editable || busy !== null}
                  value={form.dateOfBirth}
                  onChange={(event) => updateField("dateOfBirth", event.target.value)}
                />
                <p className="rrp-application-modal__hint">{t("fields.dateOfBirthHelp")}</p>
              </label>

              <fieldset className="rrp-application-modal__radios" disabled={!editable || busy !== null}>
                <legend className="rrp-application-modal__legend">{t("fields.fundingModel")}</legend>
                {(["SELF", "PARTIAL", "FULL"] as const).map((model) => (
                  <label key={model} className="rrp-application-modal__radio">
                    <input
                      type="radio"
                      name="fundingModel"
                      value={model}
                      checked={form.fundingModel === model}
                      onChange={() => {
                        updateField("fundingModel", model as RrpFundingModel);
                        if (model === "SELF") {
                          updateField("annualRequestedAmountCad", "");
                        }
                      }}
                    />
                    <span>{t(`funding.${model}`)}</span>
                  </label>
                ))}
              </fieldset>

              {form.fundingModel === "PARTIAL" || form.fundingModel === "FULL" ? (
                <label className="rrp-application-modal__field">
                  <span>{t("fields.annualRequestedAmountCad")}</span>
                  <input
                    name="annualRequestedAmountCad"
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    disabled={!editable || busy !== null}
                    value={form.annualRequestedAmountCad}
                    onChange={(event) =>
                      updateField("annualRequestedAmountCad", event.target.value)
                    }
                  />
                  <p className="rrp-application-modal__hint">{t("fields.fundingNotCommitment")}</p>
                </label>
              ) : null}

              <label className="rrp-application-modal__field">
                <span>{t("fields.teamMemberCount")}</span>
                <input
                  name="teamMemberCount"
                  type="number"
                  min={0}
                  step={1}
                  required
                  disabled={!editable || busy !== null}
                  value={form.teamMemberCount}
                  onChange={(event) => updateField("teamMemberCount", event.target.value)}
                />
              </label>

              <label className="rrp-application-modal__field">
                <span>{t("fields.relevantExperience")}</span>
                <textarea
                  name="relevantExperience"
                  required
                  disabled={!editable || busy !== null}
                  value={form.relevantExperience}
                  onChange={(event) => updateField("relevantExperience", event.target.value)}
                />
              </label>

              <label className="rrp-application-modal__field">
                <span>{t("fields.motivation")}</span>
                <textarea
                  name="motivation"
                  required
                  disabled={!editable || busy !== null}
                  value={form.motivation}
                  onChange={(event) => updateField("motivation", event.target.value)}
                />
              </label>

              <label className="rrp-application-modal__consent">
                <input
                  type="checkbox"
                  checked={form.consentAccepted}
                  disabled={!editable || busy !== null}
                  onChange={(event) => updateField("consentAccepted", event.target.checked)}
                />
                <span>
                  {t.rich("consent.label", {
                    privacy: (chunks) => (
                      <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </label>
              <p className="rrp-application-modal__hint">
                {t("consent.versionNote", { version: RRP_APPLICATION_CONSENT_VERSION })}
              </p>
            </form>
          ) : null}

          {view === "success" && active ? (
            <div className="rrp-application-modal__success" role="status">
              <p>{t("messages.submitted")}</p>
              <p className="rrp-application-modal__hint">{t("messages.notAppointment")}</p>
              <p className="rrp-application-modal__hint">{t("messages.fundingNotCommitment")}</p>
              <p className="rrp-application-modal__hint">{t("messages.moreInfoPossible")}</p>
              <p className="rrp-application-modal__hint">{t("messages.messagesLater")}</p>
              <p className="rrp-application-modal__list-meta">
                {t("hub.countryLabel", { country: active.representCountryCode })} ·{" "}
                {t(`status.${active.status}`)}
              </p>
            </div>
          ) : null}
        </div>

        <footer className="rrp-application-modal__actions">
          {view === "form" && active && editable ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                onClick={requestReturnToHub}
              >
                {t("back")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void handleWithdraw()}
              >
                {busy === "withdraw" ? t("busy.withdrawing") : t("actions.withdraw")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void handleSaveDraft()}
              >
                {busy === "save" ? t("busy.saving") : t("actions.saveDraft")}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={busy !== null}
                onClick={() => void handleSubmit()}
              >
                {busy === "submit" ? t("busy.submitting") : t("actions.submit")}
              </Button>
            </>
          ) : null}
          {view === "form" && active && !editable ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={requestReturnToHub}
              >
                {t("back")}
              </Button>
              {isRrpApplicationActiveStatus(active.status) ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void handleWithdraw()}
                >
                  {busy === "withdraw" ? t("busy.withdrawing") : t("actions.withdraw")}
                </Button>
              ) : null}
            </>
          ) : null}
          {view === "success" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStatusMessage(null);
                  goToHub();
                }}
              >
                {t("back")}
              </Button>
              <Button type="button" variant="primary" onClick={requestClose}>
                {t("close")}
              </Button>
            </>
          ) : null}
          {view === "hub" || view === "loading" ? (
            <Button type="button" variant="secondary" onClick={requestClose}>
              {t("close")}
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
    <ConfirmDialog
      isOpen={discardOpen}
      title={t("discard.title")}
      description={t("discard.description")}
      cancelLabel={t("discard.cancel")}
      confirmLabel={t("discard.confirm")}
      destructive
      onCancel={() => {
        setDiscardOpen(false);
        setPendingNavigation(null);
      }}
      onConfirm={confirmDiscard}
    />
    </>
  );
}
