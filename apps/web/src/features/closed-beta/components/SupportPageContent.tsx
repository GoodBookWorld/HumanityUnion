import { Card } from "../../../design-system/components/Card";

import "../closed-beta.css";

export function SupportPageContent() {
  return (
    <div className="support-page">
      <Card>
        <div className="support-page__section">
          <h1>Support</h1>
          <p>
            Humanity Union is in closed beta. This page provides guidance for beta participants
            reporting issues and sharing feedback.
          </p>
        </div>
      </Card>

      <Card>
        <div className="support-page__section">
          <h2>Beta feedback</h2>
          <p>
            Share observations about usability, civic workflows, and areas that feel unfinished.
            Feedback helps prioritize stabilization before wider release.
          </p>
        </div>
      </Card>

      <Card>
        <div className="support-page__section">
          <h2>Bug reporting</h2>
          <p>
            Report reproducible defects with the page URL, steps taken, and expected behavior.
            Include screenshots when helpful.
          </p>
        </div>
      </Card>

      <Card>
        <div className="support-page__section">
          <h2>Contact</h2>
          <p>Contact placeholder — beta coordinators will provide a dedicated support channel.</p>
        </div>
      </Card>

      <Card>
        <div className="support-page__section">
          <h2>Known limitations</h2>
          <ul>
            <li>Closed beta access is invite-only.</li>
            <li>Some public experience sections remain placeholders.</li>
            <li>Civic workflows may change as Capability 02 stabilizes.</li>
            <li>Email delivery depends on configured provider settings.</li>
          </ul>
        </div>
      </Card>

      <Card>
        <div className="support-page__section">
          <h2>Privacy notice</h2>
          <p>
            Beta participation data is handled according to platform privacy policies. Do not submit
            sensitive personal information through informal feedback channels.
          </p>
        </div>
      </Card>
    </div>
  );
}
