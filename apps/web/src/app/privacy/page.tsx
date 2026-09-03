import { getLocale } from "next-intl/server";

import { LegalPageShell } from "../../features/legal/components/LegalPageShell";
import {
  EXPECTED_LEGAL_FALLBACK,
  resolveLegalDocumentPresentation,
} from "../../features/legal/resolve-legal-document-presentation";
import {
  CONTACT_EMAIL,
  ORGANIZATION_ADDRESS,
  ORGANIZATION_NAME,
  ORGANIZATION_WEBSITE,
  mailtoContactLink,
} from "../../features/public-experience/footer-links";

import "../../features/legal/legal-page.css";

/** English canonical Privacy Policy body — authoritative source until counsel-approved localized copies exist. */
function EnglishPrivacyBody() {
  return (
    <>
      <section>
        <h2>Who we are</h2>
        <p>
          This Privacy Policy describes how {ORGANIZATION_NAME} (&quot;Humanity Union,&quot;
          &quot;we,&quot; &quot;us&quot;) collects, uses, and protects information when you use the
          Humanity Union civic technology platform and related public website at{" "}
          {ORGANIZATION_WEBSITE}.
        </p>
        <p>
          Registered address: {ORGANIZATION_ADDRESS}
          <br />
          Contact email: <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a>
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> email address, display name, password hash, verification
            status, and account lifecycle timestamps when you register or sign in.
          </li>
          <li>
            <strong>Authentication and session data:</strong> access and refresh tokens, session
            identifiers, login timestamps, and security-related audit events needed to protect your
            account.
          </li>
          <li>
            <strong>Member profile data:</strong> optional profile fields you choose to provide,
            visibility preferences, and profile update history.
          </li>
          <li>
            <strong>Participation area data:</strong> declared civic geography (country, region,
            community), transition requests, and effective dates used for participation eligibility.
          </li>
          <li>
            <strong>Civic activity data:</strong> initiatives, analyses, proposals, revisions,
            collective decisions, votes, implementation records, notifications, and other civic
            records you create or participate in through the platform.
          </li>
          <li>
            <strong>Nominations and public submissions:</strong> civic nomination forms, support
            statements, public poster content, and related moderation or publication status.
          </li>
          <li>
            <strong>Membership and Badge fulfillment data:</strong> optional Membership application
            details, private Member Badge request records, recipient name, delivery address,
            shipping method, fulfillment status, and Stripe payment references when an active Member
            requests the official physical Member Badge through the additional Membership
            Contribution flow.
          </li>
          <li>
            <strong>Technical data:</strong> browser type, device information, IP address, request
            logs, and error diagnostics collected for security, reliability, and abuse prevention.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>provide authentication, workspace access, and civic participation features;</li>
          <li>publish public civic records you choose to make public;</li>
          <li>
            send transactional notifications such as verification, security, and civic events;
          </li>
          <li>process optional Member Badge Contributions and fulfill physical Badge requests;</li>
          <li>maintain platform integrity, moderation, and auditability;</li>
          <li>improve reliability, accessibility, and support response.</li>
        </ul>
      </section>

      <section>
        <h2>Member Badge Contribution and fulfillment privacy</h2>
        <p>
          When an active Member chooses to request the official physical Member Badge, Humanity
          Union collects recipient and delivery address information, private contribution and
          fulfillment records, and payment processing data through Stripe. These records are used
          only for Badge fulfillment, support, and operational accounting needs. They remain
          private, are not shown on public profiles or in civic statistics, and are accessible to
          the requesting Member and future authorized fulfillment roles. Shipping and Badge request
          data are retained only as long as operational and accounting requirements require.
        </p>
      </section>

      <section>
        <h2>Cookies and session storage</h2>
        <p>
          The platform may use cookies, local storage, or similar browser technologies to maintain
          sign-in sessions, remember preferences, and protect against abuse. You can control cookies
          through your browser settings, but some features may not function without session storage.
        </p>
      </section>

      <section>
        <h2>Third-party links and embedded content</h2>
        <p>
          Public pages may link to external websites, media sources, or institutional resources.
          Humanity Union is not responsible for the privacy practices of third-party sites. Review
          their policies before providing personal information.
        </p>
      </section>

      <section>
        <h2>Data retention</h2>
        <p>
          We retain account and civic records for as long as needed to operate the platform,
          maintain public civic transparency, comply with legal obligations, resolve disputes, and
          enforce our terms. Retention periods may differ for draft records, archived civic cycles,
          and security logs.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Depending on applicable law, you may request access, correction, export, restriction, or
          deletion of personal information. Civic records that have entered public civic life may
          remain visible where transparency, auditability, or legal obligations require retention.
          Contact us to submit a privacy request.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We use administrative, technical, and organizational safeguards designed to protect
          personal information. No online service can guarantee absolute security. Report suspected
          account compromise promptly to {CONTACT_EMAIL}.
        </p>
      </section>

      <section>
        <h2>Where data may be processed</h2>
        <p>
          Information may be processed in Canada and in other jurisdictions where our infrastructure
          providers operate, subject to contractual and legal safeguards appropriate to the service.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions or requests:{" "}
          <a href={mailtoContactLink("Privacy request")}>{CONTACT_EMAIL}</a>
          <br />
          Mailing address: {ORGANIZATION_ADDRESS}
        </p>
      </section>
    </>
  );
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const presentation = await resolveLegalDocumentPresentation(locale, "privacy");

  return (
    <LegalPageShell presentation={presentation} activeDocument="privacy">
      {presentation.body.source === "approved_localized" && presentation.body.localizedBodyHtml ? (
        <div dangerouslySetInnerHTML={{ __html: presentation.body.localizedBodyHtml }} />
      ) : (
        <div data-legal-body-source={EXPECTED_LEGAL_FALLBACK}>
          <EnglishPrivacyBody />
        </div>
      )}
    </LegalPageShell>
  );
}
