import type { MembershipMePayload } from "@hu/types";
import { useEffect, useMemo, useState } from "react";

import { GeographyMultiSelect } from "../../../design-system/components/GeographyMultiSelect";
import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { toGeographyCountryOptions } from "../../../data/geography/geography.helpers";
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
      setMessage(submit ? "Application submitted successfully." : "Draft saved successfully.");
    } catch (saveError) {
      setError(formatAuthFormError(saveError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="membership-section" aria-labelledby="membership-application-title">
      <SectionHeader
        title="Membership Application"
        description="Complete your voluntary Membership application."
      />
      <Card>
        {!payload.emailConfirmed ? (
          <StatusBanner
            title="Email confirmation required"
            message="Confirm your email before starting a Membership application."
          />
        ) : applicationLocked ? (
          <StatusBanner
            title="Application submitted"
            message="Your Membership application has been submitted. Membership Contribution will be available in a future platform update."
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
              <span>Display Name</span>
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
              label="Countries of Civic Participation"
              helperText="Select the countries where you live, have community connections, or intend to participate in civic activity."
              values={participationCountryCodes}
              options={countryOptions}
              onChange={setParticipationCountryCodes}
              maxSelections={MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT}
              limitReachedMessage={`You may select up to ${MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT} countries of civic participation.`}
            />

            <fieldset className="membership-application-form__declarations">
              <legend>Membership Declaration</legend>

              <label className="membership-application-form__checkbox">
                <input
                  type="checkbox"
                  checked={understandMembershipMeaning}
                  onChange={(event) => setUnderstandMembershipMeaning(event.target.checked)}
                />
                <span>I understand the purpose of Humanity Union Membership.</span>
              </label>

              <label className="membership-application-form__checkbox">
                <input
                  type="checkbox"
                  checked={understandNoVoteWeightChange}
                  onChange={(event) => setUnderstandNoVoteWeightChange(event.target.checked)}
                />
                <span>I understand that Membership does not change voting power.</span>
              </label>

              <label className="membership-application-form__checkbox">
                <input
                  type="checkbox"
                  checked={understandDataPolicy}
                  onChange={(event) => setUnderstandDataPolicy(event.target.checked)}
                />
                <span>I understand Humanity Union&apos;s Membership data policy.</span>
              </label>
            </fieldset>

            {message ? <StatusBanner title="Success" message={message} /> : null}
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
                Save Draft
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                Submit Application
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
