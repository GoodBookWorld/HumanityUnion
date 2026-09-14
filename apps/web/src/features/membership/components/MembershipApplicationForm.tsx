import type { MembershipMePayload } from "@hu/types";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import { GeographyMultiSelect } from "../../../design-system/components/GeographyMultiSelect";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { toGeographyCountryOptions } from "@hu/geography";
import { formatAuthFormError } from "../../../lib/api-client";
import { getMyMemberProfile } from "../../member-profile/member-profile-api";
import { updateMembershipApplication } from "../membership-api";

const MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT = 10;

function resolveParticipationCodes(
  countryCode: string | null | undefined,
  participationCountryCodes: string[] | null | undefined,
): string[] {
  if (Array.isArray(participationCountryCodes) && participationCountryCodes.length > 0) {
    return participationCountryCodes;
  }

  if (countryCode) {
    return [countryCode];
  }

  return [];
}

interface MembershipApplicationFormProps {
  payload: MembershipMePayload;
  onUpdated: (payload: MembershipMePayload) => void;
}

export function MembershipApplicationForm({ payload, onUpdated }: MembershipApplicationFormProps) {
  const t = useTranslations("membershipPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const countryOptions = useMemo(() => toGeographyCountryOptions(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [participationCountryCodes, setParticipationCountryCodes] = useState<string[]>(() =>
    resolveParticipationCodes(
      payload.application.countryCode,
      payload.application.participationCountryCodes,
    ),
  );
  const [displayNameConfirmed, setDisplayNameConfirmed] = useState(
    payload.application.displayNameConfirmed ?? "",
  );
  const [displayNameReadOnly, setDisplayNameReadOnly] = useState(false);
  const [understandMembershipMeaning, setUnderstandMembershipMeaning] = useState(false);
  const [understandNoVoteWeightChange, setUnderstandNoVoteWeightChange] = useState(false);
  const [understandDataPolicy, setUnderstandDataPolicy] = useState(false);

  useEffect(() => {
    setParticipationCountryCodes(
      resolveParticipationCodes(
        payload.application.countryCode,
        payload.application.participationCountryCodes,
      ),
    );
  }, [payload.application.countryCode, payload.application.participationCountryCodes]);

  useEffect(() => {
    if (!payload.emailConfirmed) {
      return;
    }

    let cancelled = false;

    void getMyMemberProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }

        const confirmedName = payload.application.displayNameConfirmed ?? profile.displayName;
        setDisplayNameConfirmed(confirmedName);
        setDisplayNameReadOnly(true);
      })
      .catch(() => {
        if (!cancelled && payload.application.displayNameConfirmed) {
          setDisplayNameReadOnly(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [payload.application.displayNameConfirmed, payload.emailConfirmed]);

  const applicationLocked =
    payload.membership.applicationStatus === "submitted" ||
    payload.membership.applicationStatus === "approved" ||
    payload.membership.status === "active_member";

  async function handleSave(submit: boolean) {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await updateMembershipApplication({
        participationCountryCodes,
        displayNameConfirmed,
        understandMembershipMeaning,
        understandNoVoteWeightChange,
        understandDataPolicy,
        submit,
      });

      onUpdated(result);
      setMessage(submit ? t("application.submittedSuccess") : t("application.draftSaved"));
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="membership-section" aria-labelledby="membership-application-title">
      <SectionHeader
        title={t("application.title")}
        description={t("application.description")}
        titleId="membership-application-title"
      />
      <Card>
        {!payload.emailConfirmed ? (
          <StatusBanner
            title={t("application.emailRequiredTitle")}
            message={t("application.emailRequiredMessage")}
          />
        ) : applicationLocked ? (
          <StatusBanner
            title={t("application.submittedTitle")}
            message={t("application.submittedMessage")}
          />
        ) : (
          <form
            className="membership-application-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave(true);
            }}
            noValidate
          >
            <label className="membership-application-form__field" htmlFor="membership-display-name">
              <span>{t("application.displayName")}</span>
              <input
                id="membership-display-name"
                type="text"
                required
                readOnly={displayNameReadOnly}
                value={displayNameConfirmed}
                onChange={(event) => setDisplayNameConfirmed(event.target.value)}
                aria-readonly={displayNameReadOnly || undefined}
              />
            </label>

            <GeographyMultiSelect
              id="membership-participation-countries"
              label={t("application.countriesLabel")}
              helperText={t("application.countriesHelper")}
              values={participationCountryCodes}
              options={countryOptions}
              onChange={setParticipationCountryCodes}
              maxSelections={MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT}
              limitReachedMessage={t("application.countriesLimit", {
                max: MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT,
              })}
            />

            <fieldset className="membership-application-form__declarations">
              <legend>{t("application.declarationLegend")}</legend>

              <label className="membership-application-form__checkbox">
                <input
                  type="checkbox"
                  checked={understandMembershipMeaning}
                  onChange={(event) => setUnderstandMembershipMeaning(event.target.checked)}
                />
                <span>{t("application.declareMeaning", siteName)}</span>
              </label>

              <label className="membership-application-form__checkbox">
                <input
                  type="checkbox"
                  checked={understandNoVoteWeightChange}
                  onChange={(event) => setUnderstandNoVoteWeightChange(event.target.checked)}
                />
                <span>{t("application.declareVoteWeight")}</span>
              </label>

              <label className="membership-application-form__checkbox">
                <input
                  type="checkbox"
                  checked={understandDataPolicy}
                  onChange={(event) => setUnderstandDataPolicy(event.target.checked)}
                />
                <span>{t("application.declareDataPolicy", siteName)}</span>
              </label>
            </fieldset>

            {message ? <StatusBanner title={t("application.successTitle")} message={message} /> : null}
            {error ? (
              <div className="membership-application-form__error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="membership-application-form__actions">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => void handleSave(false)}
              >
                {t("application.saveDraft")}
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {t("application.submit")}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
