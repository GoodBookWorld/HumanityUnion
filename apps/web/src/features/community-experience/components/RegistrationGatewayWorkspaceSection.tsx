import Link from "next/link";

import {
  REGISTRATION_GATEWAY_WORKSPACE_CONTENT,
  REGISTRATION_VISITOR_CONCLUSION,
  registrationGatewayContextIntroduction,
  workspaceContinuationContextIntroduction,
} from "../content";
import { WORKSPACE_ROUTE } from "../constants";
import { ExperienceBlockShell, REGISTRATION_ROUTE } from "../../public-experience";

interface RegistrationGatewayWorkspaceSectionProps {
  communityName: string;
  isAuthenticated?: boolean;
}

export function RegistrationGatewayWorkspaceSection({
  communityName,
  isAuthenticated = false,
}: RegistrationGatewayWorkspaceSectionProps) {
  return (
    <ExperienceBlockShell
      id="registration-gateway-workspace"
      title={
        isAuthenticated
          ? REGISTRATION_GATEWAY_WORKSPACE_CONTENT.workspaceActionLabel
          : REGISTRATION_GATEWAY_WORKSPACE_CONTENT.title
      }
      architecturalName="Registration Gateway"
      stage="Participation"
      contextIntroduction={
        isAuthenticated
          ? workspaceContinuationContextIntroduction(communityName)
          : registrationGatewayContextIntroduction(communityName)
      }
      visitorConclusion={REGISTRATION_VISITOR_CONCLUSION}
    >
      <div className="registration-gateway">
        <p className="registration-gateway__invitation">
          {isAuthenticated
            ? REGISTRATION_GATEWAY_WORKSPACE_CONTENT.authenticatedNote
            : REGISTRATION_GATEWAY_WORKSPACE_CONTENT.invitation}
        </p>
        <p className="registration-gateway__exploration-note">
          {REGISTRATION_GATEWAY_WORKSPACE_CONTENT.explorationNote}
        </p>

        <div className="registration-gateway__actions">
          {isAuthenticated ? (
            WORKSPACE_ROUTE ? (
              <Link className="registration-gateway__action" href={WORKSPACE_ROUTE}>
                {REGISTRATION_GATEWAY_WORKSPACE_CONTENT.workspaceActionLabel}
              </Link>
            ) : (
              <span
                className="registration-gateway__action registration-gateway__action--placeholder"
                role="status"
                aria-disabled="true"
              >
                {REGISTRATION_GATEWAY_WORKSPACE_CONTENT.workspaceActionLabel}
                <span className="registration-gateway__action-note">
                  {" "}
                  — {REGISTRATION_GATEWAY_WORKSPACE_CONTENT.workspacePlaceholderLabel}
                </span>
              </span>
            )
          ) : REGISTRATION_ROUTE ? (
            <Link className="registration-gateway__action" href={REGISTRATION_ROUTE}>
              {REGISTRATION_GATEWAY_WORKSPACE_CONTENT.registrationActionLabel}
            </Link>
          ) : (
            <span
              className="registration-gateway__action registration-gateway__action--placeholder"
              role="status"
              aria-disabled="true"
            >
              {REGISTRATION_GATEWAY_WORKSPACE_CONTENT.registrationActionLabel}
              <span className="registration-gateway__action-note">
                {" "}
                — {REGISTRATION_GATEWAY_WORKSPACE_CONTENT.registrationPlaceholderLabel}
              </span>
            </span>
          )}
        </div>

        <p className="registration-gateway__boundary" role="note">
          Public Experience ends here. Workspace begins personal accountable participation when you
          choose.
        </p>
      </div>
    </ExperienceBlockShell>
  );
}
