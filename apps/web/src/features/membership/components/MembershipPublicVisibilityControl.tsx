"use client";

import type { MemberProfilePrivacySettings } from "@hu/types";
import { useState } from "react";

import {
  MEMBERSHIP_VISIBILITY_DESCRIPTION,
  MEMBERSHIP_VISIBILITY_LABEL,
} from "../membership.constants";
import { updateMyMemberProfilePrivacy } from "../../member-profile/member-profile-api";
import { MEMBER_PROFILE_UPDATED_EVENT } from "../../member-profile/member-profile-events";

interface MembershipPublicVisibilityControlProps {
  privacy: MemberProfilePrivacySettings;
  isActiveMember: boolean;
  onUpdated: (privacy: MemberProfilePrivacySettings) => void;
}

export function MembershipPublicVisibilityControl({
  privacy,
  isActiveMember,
  onUpdated,
}: MembershipPublicVisibilityControlProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(checked: boolean) {
    if (!isActiveMember) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateMyMemberProfilePrivacy({
        membershipPubliclyVisible: checked,
      });
      onUpdated(updated);
      setMessage("Membership visibility preference saved.");
      window.dispatchEvent(new Event(MEMBER_PROFILE_UPDATED_EVENT));
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save visibility setting.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="membership-public-visibility">
      <label className="membership-application-form__checkbox">
        <input
          type="checkbox"
          checked={privacy.membershipPubliclyVisible}
          disabled={!isActiveMember || saving}
          onChange={(event) => void handleToggle(event.target.checked)}
          aria-describedby="membership-public-visibility-description"
        />
        <span>{MEMBERSHIP_VISIBILITY_LABEL}</span>
      </label>
      <p
        id="membership-public-visibility-description"
        className="membership-public-visibility__description"
      >
        {MEMBERSHIP_VISIBILITY_DESCRIPTION}
      </p>
      {!isActiveMember ? (
        <p className="membership-public-visibility__description" role="note">
          Public Member Number visibility becomes available after Membership activation. Member
          status appears automatically once you are a Member.
        </p>
      ) : null}
      {message ? (
        <p className="membership-public-visibility__message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="membership-application-form__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
