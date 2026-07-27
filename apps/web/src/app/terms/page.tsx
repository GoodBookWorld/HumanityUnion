import { LegalPageShell } from "../../features/legal/components/LegalPageShell";
import {
  CONTACT_EMAIL,
  ORGANIZATION_ADDRESS,
  ORGANIZATION_NAME,
  ORGANIZATION_WEBSITE,
  mailtoContactLink,
} from "../../features/public-experience/footer-links";

import "../../features/legal/legal-page.css";

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Use"
      counselNote="This document should be reviewed by legal counsel before public launch."
    >
      <section>
        <h2>Acceptance of terms</h2>
        <p>
          By accessing or using the Humanity Union platform operated by {ORGANIZATION_NAME}, you
          agree to these Terms of Use. If you do not agree, do not use the platform.
        </p>
      </section>

      <section>
        <h2>Account eligibility and security</h2>
        <p>
          You must provide accurate registration information and maintain the confidentiality of
          your credentials. You are responsible for activity under your account and must notify us
          promptly of unauthorized access.
        </p>
      </section>

      <section>
        <h2>Civic participation rules</h2>
        <p>
          Humanity Union supports structured civic participation. You agree to use workspace tools
          honestly, respect participation-area eligibility rules, and avoid impersonation, fraud,
          harassment, or attempts to manipulate civic outcomes.
        </p>
      </section>

      <section>
        <h2>Nominations, voting, and public submissions</h2>
        <p>
          Civic nominations, support voting, and public submissions must reflect good-faith civic
          intent. You must not submit false identity claims, deceptive nomination content, or
          automated vote manipulation. Moderators may review, delay, or remove content that violates
          platform integrity rules.
        </p>
      </section>

      <section>
        <h2>Membership and optional Member Badge</h2>
        <p>
          Humanity Union Membership is voluntary and separate from core civic participation.
          Membership activation follows the one-time Membership Contribution process described on
          the Membership pages. Active Members may optionally request the official physical Member
          Badge through an additional 20 CAD Membership Contribution plus separately configured
          shipping.
        </p>
        <p>
          Requesting, cancelling, refunding, or not requesting the physical Badge does not change
          Membership status, Member Number, voting weight, or civic eligibility. Badge availability
          and shipping destinations are limited to configured regions. Production Badge
          Contributions may remain unavailable until operational policies are approved.
        </p>
      </section>

      <section>
        <h2>Intellectual property</h2>
        <p>
          Platform software, branding, and documentation are owned by Humanity Union or its
          licensors. You retain rights to content you submit, but grant Humanity Union the rights
          needed to host, display, and publish civic records you choose to make public on the
          platform.
        </p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          Our collection and use of personal information is described in the{" "}
          <a href="/privacy">Privacy Policy</a>. By using the platform, you acknowledge that policy.
        </p>
      </section>

      <section>
        <h2>Third-party links</h2>
        <p>
          The platform may reference external institutions, media, or civic resources. Humanity
          Union does not control third-party sites and is not responsible for their content or
          practices.
        </p>
      </section>

      <section>
        <h2>No guarantees</h2>
        <p>
          The platform is provided for civic coordination and transparency. We do not guarantee
          uninterrupted availability, specific civic outcomes, institutional response, or legal
          effect of any participation record.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by applicable law, Humanity Union is not liable for
          indirect, incidental, special, consequential, or punitive damages arising from platform
          use, civic participation, or reliance on public civic records.
        </p>
      </section>

      <section>
        <h2>Platform moderation</h2>
        <p>
          We may suspend or terminate accounts, restrict participation, or remove content that
          violates these Terms, threatens platform integrity, or creates legal or safety risk.
        </p>
      </section>

      <section>
        <h2>Changes to terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be posted on the
          platform. Continued use after changes become effective constitutes acceptance of the
          revised Terms.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          These Terms are intended to be governed by the applicable laws of British Columbia and
          Canada, unless otherwise required by law.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a href={mailtoContactLink("Terms inquiry")}>{CONTACT_EMAIL}</a>
          <br />
          Website: <a href={ORGANIZATION_WEBSITE}>{ORGANIZATION_WEBSITE}</a>
          <br />
          Mailing address: {ORGANIZATION_ADDRESS}
        </p>
      </section>
    </LegalPageShell>
  );
}
