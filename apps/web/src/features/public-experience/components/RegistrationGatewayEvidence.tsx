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
        <Link className="registration-gateway__action" href={REGISTRATION_ROUTE}>
          {REGISTRATION_GATEWAY_CONTENT.actionLabel}
        </Link>
      </div>

      <p className="registration-gateway__about">
        <Link href="/knowledge" className="registration-gateway__about-link">
          Learn about Humanity Union before creating an account
        </Link>
      </p>
    </div>
  );
}
