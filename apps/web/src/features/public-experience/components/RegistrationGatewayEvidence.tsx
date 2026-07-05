import Link from "next/link";

import { REGISTRATION_GATEWAY_CONTENT } from "../content";
import { REGISTRATION_ROUTE } from "../footer-links";

export function RegistrationGatewayEvidence() {
  return (
    <div className="registration-gateway">
      <p className="registration-gateway__invitation">{REGISTRATION_GATEWAY_CONTENT.invitation}</p>
      <p className="registration-gateway__exploration-note">
        {REGISTRATION_GATEWAY_CONTENT.explorationNote}
      </p>

      <div className="registration-gateway__actions">
        {REGISTRATION_ROUTE ? (
          <Link className="registration-gateway__action" href={REGISTRATION_ROUTE}>
            {REGISTRATION_GATEWAY_CONTENT.actionLabel}
          </Link>
        ) : (
          <span
            className="registration-gateway__action registration-gateway__action--placeholder"
            role="status"
            aria-disabled="true"
            title={REGISTRATION_GATEWAY_CONTENT.placeholderActionLabel}
          >
            {REGISTRATION_GATEWAY_CONTENT.actionLabel}
            <span className="registration-gateway__action-note">
              {" "}
              — {REGISTRATION_GATEWAY_CONTENT.placeholderActionLabel}
            </span>
          </span>
        )}
      </div>

      <p className="registration-gateway__about">
        <span className="registration-gateway__about-placeholder" title="About — coming soon">
          Learn about Humanity Union before registering
          <span className="registration-gateway__about-note"> (coming soon)</span>
        </span>
      </p>
    </div>
  );
}
