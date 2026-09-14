"use client";

import type { MemberProfilePrivacySettings } from "@hu/types";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
  const t = useTranslations("membershipPublic.publicVisibility");
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
      setMessage(t("saved"));
      window.dispatchEvent(new Event(MEMBER_PROFILE_UPDATED_EVENT));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("saveError"));
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
        <span>{t("label")}</span>
      </label>
      <p
        id="membership-public-visibility-description"
        className="membership-public-visibility__description"
      >
        {t("description")}
      </p>
      {!isActiveMember ? (
        <p className="membership-public-visibility__description" role="note">
          {t("inactiveNote")}
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
