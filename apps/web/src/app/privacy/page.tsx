import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
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
import { buildPublicPageMetadataForRequest } from "../../lib/seo/build-public-page-metadata-for-request";

import "../../features/legal/legal-page.css";

/**
 * Step 07F.2 — Privacy SEO title from WEB_UI legalPublic chrome; description from
 * Brand defaultMetaDescription. Legal body remains Legal Localization / English
 * canonical — never used as SEO description. No dedicated Privacy SEO desc field exists.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("legalPublic");
  return buildPublicPageMetadataForRequest({
    title: t("privacy.title"),
    description: brand.defaultMetaDescription,
    canonicalPath: "/privacy",
    localeFreeCanonicalPath: "/privacy",
    openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
  });
}

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
            <strong>Regional Representative Program application data:</strong> when you apply,
            legal name and identity fields, date of birth (for age eligibility), residence country,
            representation country, professional background, experience and motivation text, funding
            model and any CAD amount requested, consent version and acceptance timestamp, application
            status, and administrator review or decision history. See the dedicated section below.
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
            send transactional and security emails such as verification, sign-in protection, and
            account recovery;
          </li>
          <li>
            send optional Notification Center email copies when you explicitly opt in (see below);
          </li>
          <li>process optional Member Badge Contributions and fulfill physical Badge requests;</li>
          <li>
            review and administer Regional Representative Program applications, including related
            Direct Messaging notifications where applicable;
          </li>
          <li>maintain platform integrity, moderation, and auditability;</li>
          <li>improve reliability, accessibility, and support response.</li>
        </ul>
      </section>

      <section>
        <h2>Optional Notification Center email copies</h2>
        <p>
          Separately from security and account transactional email, you may choose to receive email
          copies of selected Notification Center activity. This is optional and requires your
          explicit opt-in in Notification Preferences or the Notification Center email settings.
        </p>
        <ul>
          <li>
            <strong>Opt-in only:</strong> email copies are not enabled by default. You can change
            preferences or disable email copies at any time. Turning copies off does not stop
            security, verification, password reset, or other account transactional email, and does
            not remove in-app Notification Center items.
          </li>
          <li>
            <strong>Destination:</strong> copies are sent to your verified account email or to a
            separately verified alternative notification email that you confirm. An alternative
            notification email does not replace your account login email.
          </li>
          <li>
            <strong>Frequency:</strong> when copies are enabled, you may choose immediate, daily
            digest, or weekly digest delivery according to your saved preferences. Platform-only
            settings keep activity in the Notification Center without email copies.
          </li>
          <li>
            <strong>Content limits:</strong> email copies use fixed category summaries for selected
            allowlisted events. Private notification bodies, private messages, and confidential
            collaboration content are not included in these email copies.
          </li>
          <li>
            <strong>Operational metadata:</strong> to operate delivery we process delivery status
            and related operational metadata (for example attempt timing, acceptance or failure
            signals, and preference state at send time). Saving a preference does not by itself mean
            an email was sent.
          </li>
          <li>
            <strong>Email providers:</strong> messages are transmitted through our email delivery
            infrastructure and providers as needed to attempt delivery. Delivery is not guaranteed
            for every event and is not claimed to be exactly-once.
          </li>
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

      <section data-rrp-privacy-disclosure="draft-requires-legal-review">
        <h2>Regional Representative Program applications</h2>
        <p>
          <strong>Draft for legal review.</strong> This section describes how the Regional
          Representative Program (RRP) processes applicant information on the platform. It is not a
          published counsel-approved legal text until legal review and any required Legal
          Localization republication are complete.
        </p>
        <p>
          When you submit an RRP application, Humanity Union processes the following application
          fields for eligibility, review, and program administration: legal first and last name
          (identity), date of birth (to confirm you meet the minimum age of 18), country of
          residence, country you seek to represent, profession and professional background,
          relevant experience, motivation, funding model, and any annual amount requested in CAD.
          Funding requests are not approved financial commitments. Submission is not a
          Representative appointment and does not grant legal authority, employment status, funding
          entitlement, contract-signing authority, or administrator permissions. Any separate legal
          appointment process, if used, is outside this platform disclosure.
        </p>
        <p>
          Administrators with appropriate access may review applications, request more information,
          record decisions, and maintain decision history tied to the application. Applicants may
          view and manage their own applications. Date of birth and other sensitive application
          fields are not shown on public profiles, public directories, or civic statistics.
        </p>
        <p>
          Follow-up between applicants and administrators may use the platform&apos;s existing
          Messages capability, subject to recipient privacy settings and account eligibility.
          Message or notification delivery is not guaranteed for every event.
        </p>
        <p>
          Withdrawal ends the active application process for that application; it is not the same
          as deletion of stored records. Retention duration for RRP application records, decision
          history, and related Messages metadata is not yet fixed by an explicit product or legal
          policy decision and requires that decision before launch claims about specific retention
          periods. Deletion or other privacy requests may be submitted through the contact channels
          in this Policy and will be handled according to applicable law and platform procedures.
          Application data may be processed in Canada and in other jurisdictions where our
          infrastructure providers operate, subject to contractual and legal safeguards appropriate
          to the service.
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
