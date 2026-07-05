import { REGISTRATION_GATEWAY_CONTENT } from "../content";
import { ExperienceBlockShell } from "./ExperienceBlockShell";
import { RegistrationGatewayEvidence } from "./RegistrationGatewayEvidence";

export function RegistrationGatewaySection() {
  return (
    <ExperienceBlockShell
      id="registration-gateway"
      title={REGISTRATION_GATEWAY_CONTENT.title}
      architecturalName="Registration Gateway"
      stage="Participation"
      contextIntroduction={REGISTRATION_GATEWAY_CONTENT.contextIntroduction}
      visitorConclusion={REGISTRATION_GATEWAY_CONTENT.visitorConclusion}
    >
      <RegistrationGatewayEvidence />
    </ExperienceBlockShell>
  );
}
