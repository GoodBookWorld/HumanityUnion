"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { useOpenDirectConversation } from "../../direct-messaging/use-open-direct-conversation";

import "./allies-widget.css";

const MESSAGE_ICON = "/icons/workspace/message.svg";

export interface AllyCard {
  participantId: string;
  displayName: string;
  avatarUrl?: string | null;
  profileUrl?: string;
  sharedInitiativeCount?: number;
  hasUnreadMessages?: boolean;
}

function AllyMessageButton({ ally }: { ally: AllyCard }) {
  const t = useTranslations("workspace");
  const { isOpening, errorMessage, openConversation } = useOpenDirectConversation();

  return (
    <div className="allies-widget__message-wrap">
      <button
        type="button"
        className="allies-widget__message-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openConversation({ participantId: ally.participantId });
        }}
        disabled={isOpening}
        aria-label={t("home.alliesMessageAria", { name: ally.displayName })}
        aria-live="polite"
      >
        <Image src={MESSAGE_ICON} alt="" width={18} height={18} aria-hidden="true" />
        <span className="allies-widget__message-label">
          {isOpening ? t("home.alliesOpening") : t("home.alliesMessage")}
        </span>
        {ally.hasUnreadMessages ? (
          <>
            <span className="allies-widget__unread-dot" aria-hidden="true" />
            <span className="allies-widget__visually-hidden">
              {t("home.alliesUnreadAria", { name: ally.displayName })}
            </span>
          </>
        ) : null}
      </button>
      {errorMessage ? <p className="allies-widget__message-error">{errorMessage}</p> : null}
    </div>
  );
}

interface AlliesWidgetProps {
  allies?: AllyCard[];
}

export function AlliesWidget({ allies = [] }: AlliesWidgetProps) {
  const t = useTranslations("workspace");

  return (
    <div className="allies-widget">
      {allies.length === 0 ? (
        <p className="allies-widget__empty">{t("home.alliesEmpty")}</p>
      ) : (
        <ul className="allies-widget__list" aria-label={t("home.alliesListAria")}>
          {allies.map((ally) => {
            const identityContent = (
              <>
                <HumanityAvatar
                  className="allies-widget__avatar"
                  avatarUrl={ally.avatarUrl}
                  size={36}
                  alt=""
                />
                <span>
                  <p className="allies-widget__name">{ally.displayName}</p>
                  {ally.sharedInitiativeCount && ally.sharedInitiativeCount > 1 ? (
                    <p className="allies-widget__shared-count">
                      {t("home.alliesSharedInitiatives", {
                        count: ally.sharedInitiativeCount,
                      })}
                    </p>
                  ) : null}
                </span>
              </>
            );

            return (
              <li key={ally.participantId} className="allies-widget__card">
                {ally.profileUrl ? (
                  <Link className="allies-widget__identity" href={ally.profileUrl}>
                    {identityContent}
                  </Link>
                ) : (
                  <span className="allies-widget__identity">{identityContent}</span>
                )}
                <AllyMessageButton ally={ally} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
