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

/**
 * HU-ACCOUNT-DELETE-01O — English canonical Privacy Policy body (approved 19-section
 * document, Effective Date November 22, 2026). Authoritative until counsel-approved
 * localized copies are published via Admin → Legal Localization for privacy-2026-11-v2.
 */
function EnglishPrivacyBody() {
  return (
    <>
      <header className="legal-page__doc-header">
        <p className="legal-page__doc-org">
          <strong>{ORGANIZATION_NAME}</strong>
        </p>
        <p className="legal-page__doc-effective">
          <strong>Effective Date: November 22, 2026</strong>
        </p>
      </header>

      <section aria-labelledby="privacy-section-1">
        <h2 id="privacy-section-1">1. Who We Are</h2>
        <p>
          {ORGANIZATION_NAME} (“Humanity Union,” “we,” “us,” or “our”) is a Canadian nonprofit organization supporting civic education, responsible public participation, collaboration, and the development of solutions to social challenges through the Humanity Union platform.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, protect, retain, and disclose information when you visit or use our website and related services at {ORGANIZATION_WEBSITE}.
        </p>
        <p>
          <strong>Registered address:</strong> 514 Vernon St., Nelson, BC V1L 5R4, Canada
        </p>
        <p>
          <strong>Contact email:</strong> <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a>
        </p>
      </section>

      <section aria-labelledby="privacy-section-2">
        <h2 id="privacy-section-2">2. Our Privacy Principles</h2>
        <p>
          Humanity Union is built on respect for human dignity, freedom of expression, voluntary participation, and individual privacy.
        </p>
        <p>
          We follow these principles:
        </p>
        <ul>
          <li><strong>Data minimization:</strong> We seek to collect only information reasonably necessary to provide, secure, and improve our services.</li>
          <li><strong>Freedom of identity:</strong> Participants may use a display name or pseudonym and are not generally required to disclose or verify their legal identity to access core civic participation features.</li>
          <li><strong>Voluntary disclosure:</strong> Additional personal and professional information is generally optional, except where particular services require specific information to function.</li>
          <li><strong>Participant control:</strong> Users can manage available profile information, visibility settings, and communication preferences.</li>
          <li><strong>Purpose limitation:</strong> Personal information is used for legitimate, identified platform purposes and is not collected for unrelated commercial profiling.</li>
          <li><strong>Transparency:</strong> We explain how information is processed and how participants can exercise their privacy rights.</li>
        </ul>
        <p>
          Using a pseudonym does not make an account technically anonymous to Humanity Union. Account credentials, communications, and technical information may still constitute personal information.
        </p>
      </section>

      <section aria-labelledby="privacy-section-3">
        <h2 id="privacy-section-3">3. Information We Collect</h2>
        <p>
          Depending on how you use the platform, we may process the following categories of information.
        </p>
        <h3>3.1. Account and Authentication Information</h3>
        <p>
          Email address, chosen display name or pseudonym, password hash, account verification status, session identifiers, authentication tokens, login history, and security-related records.
        </p>
        <p>
          Email verification confirms control of an email address; it does not verify a participant's legal identity.
        </p>
        <h3>3.2. Voluntary Profile Information</h3>
        <p>
          Information participants choose to provide, such as location, interests, experience, professional background, biography, photographs, or other profile details.
        </p>
        <p>
          We do not generally verify the accuracy of voluntarily supplied identity or professional information.
        </p>
        <h3>3.3. Civic Participation Information</h3>
        <p>
          Information associated with initiatives, proposals, discussions, analyses, petitions, signatures, votes, nominations, collective decisions, implementation activities, publications, and other civic participation tools.
        </p>
        <p>
          Some civic records are intended for public visibility and may remain part of the platform's civic archive, subject to applicable privacy rights and moderation rules.
        </p>
        <h3>3.4. Communications</h3>
        <p>
          Messages, support requests, notifications, communication preferences, and related operational information.
        </p>
        <p>
          Private messages are not intended for public display. Access is restricted according to the platform's authorization rules, although authorized personnel may need access in limited circumstances involving security, abuse investigations, technical support, or legal obligations.
        </p>
        <h3>3.5. Voluntary Applications and Organizational Participation</h3>
        <p>
          Participants may voluntarily express interest in volunteering, collaboration, regional coordination, or the Regional Representative Program (RRP).
        </p>
        <p>
          Such applications may include a chosen name or pseudonym, contact information, declared country or region, relevant experience, motivation, proposed activities, and optional information concerning resources or funding needs.
        </p>
        <p>
          Submitting an application is an expression of interest. It does not, by itself, establish employment, legal representation, contractual authority, organizational appointment, or a commitment to provide funding.
        </p>
        <p>
          Humanity Union does not treat information supplied in an application as independently verified unless a separate verification process is expressly communicated.
        </p>
        <p>
          Application information may be reviewed by authorized administrators for communication, assessment, coordination, and organizational recordkeeping.
        </p>
        <p>
          Participants may withdraw an application. Withdrawal does not necessarily result in immediate deletion of records already needed for legitimate administrative, security, dispute-resolution, or legal purposes.
        </p>
        <h3>3.6. Membership and Physical Member Badge Information</h3>
        <p>
          Where applicable, voluntary membership-related services or requests for physical Member Badges may involve recipient details, delivery addresses, fulfillment records, and payment references.
        </p>
        <p>
          Payment processing may be performed by third-party payment providers, including Stripe. We do not require participants to use optional paid services to access ordinary civic participation features.
        </p>
        <h3>3.7. Technical and Usage Information</h3>
        <p>
          We may process IP addresses, browser and device information, access logs, error reports, security events, and limited usage analytics to maintain platform functionality, reliability, accessibility, and protection against abuse.
        </p>
      </section>

      <section aria-labelledby="privacy-section-4">
        <h2 id="privacy-section-4">4. How We Use Information</h2>
        <p>
          We use information to:
        </p>
        <ul>
          <li>Provide account registration, authentication, and platform functionality.</li>
          <li>Enable civic participation, collaboration, and publication of participant-submitted public content.</li>
          <li>Support voluntary applications and organizational coordination.</li>
          <li>Facilitate communications between participants and authorized administrators.</li>
          <li>Deliver account-related, security, and requested notifications.</li>
          <li>Process optional membership services and physical Badge fulfillment.</li>
          <li>Prevent fraud, spam, unauthorized access, and misuse.</li>
          <li>Maintain operational records, investigate incidents, and respond to legitimate requests.</li>
          <li>Improve platform accessibility, performance, and reliability.</li>
          <li>Comply with applicable legal obligations.</li>
        </ul>
        <p>
          We do not sell personal information to advertisers or use participant information for third-party behavioral advertising.
        </p>
      </section>

      <section aria-labelledby="privacy-section-5">
        <h2 id="privacy-section-5">5. Consent and Legal Grounds for Processing</h2>
        <p>
          We collect, use, and disclose personal information with consent where required, or where otherwise permitted or required by applicable law.
        </p>
        <p>
          For individuals whose information is subject to the General Data Protection Regulation (GDPR), processing may rely, as appropriate, on consent, performance of a contract, legitimate interests, or compliance with legal obligations.
        </p>
        <p>
          Where we rely on legitimate interests, these may include platform security, service reliability, moderation, and prevention of abuse, subject to applicable balancing requirements.
        </p>
        <p>
          Participants may withdraw consent for optional processing where consent is the applicable legal basis. Withdrawal does not invalidate processing lawfully performed before withdrawal and may not require deletion of information retained on another lawful basis.
        </p>
      </section>

      <section aria-labelledby="privacy-section-6">
        <h2 id="privacy-section-6">6. Public Participation and Visibility</h2>
        <p>
          Humanity Union provides tools for public civic engagement.
        </p>
        <p>
          Participants should understand that information they deliberately publish in public initiatives, petitions, comments, blogs, or other public areas may be viewed, copied, or referenced by others.
        </p>
        <p>
          Using a pseudonym can reduce public identification but cannot guarantee anonymity, particularly when published content contains identifying details.
        </p>
        <p>
          Public civic records may be retained or anonymized where reasonably necessary to preserve the integrity and transparency of collective civic processes, subject to applicable law.
        </p>
        <p>
          Participants should avoid including unnecessary sensitive personal information about themselves or others in public submissions.
        </p>
        <p>
          Closing an account does not, by itself, remove public civic records. A request to anonymize a public author name is handled under section 13.
        </p>
      </section>

      <section aria-labelledby="privacy-section-7">
        <h2 id="privacy-section-7">7. Private Messages and Communications</h2>
        <p>
          Private Messages are designed for communication between authorized participants.
        </p>
        <p>
          They are not public civic publications and are subject to the platform's access controls.
        </p>
        <p>
          We do not use private message content for advertising.
        </p>
        <p>
          Access to private communications may occur only where reasonably necessary for authorized operational purposes, protection of users, investigation of reported abuse, or compliance with applicable law.
        </p>
        <p>
          If a participant closes an account, private messages remain available to the other participants in those conversations, as described in section 13.
        </p>
      </section>

      <section aria-labelledby="privacy-section-8">
        <h2 id="privacy-section-8">8. Notifications and Email Communications</h2>
        <p>
          Humanity Union may send essential account and security communications, including verification, account recovery, and security alerts.
        </p>
        <p>
          Optional email copies of Notification Center activity require the participant's applicable opt-in.
        </p>
        <p>
          Participants may manage available notification categories, delivery frequency, and email preferences through their account settings.
        </p>
        <p>
          Optional email notifications may be sent immediately or as periodic summaries, depending on supported preferences.
        </p>
        <p>
          Private message bodies and confidential collaboration content are not included in optional Notification Center email summaries.
        </p>
        <p>
          Email delivery may involve authorized service providers and associated delivery metadata.
        </p>
        <p>
          Messages about account deletion, the recovery reminder, and account closure are essential account communications. Humanity Union attempts to send them. Delivery is not guaranteed, and a delivery failure does not extend a recovery deadline.
        </p>
      </section>

      <section aria-labelledby="privacy-section-9">
        <h2 id="privacy-section-9">9. Cookies, Local Storage, and Analytics</h2>
        <p>
          Humanity Union uses cookies, local storage, and similar technologies for authentication, session management, security, interface preferences, and limited platform analytics.
        </p>
        <p>
          We do not use third-party behavioral advertising or cross-site advertising tracking cookies.
        </p>
        <p>
          Some essential technologies are necessary for account functionality. Disabling them may prevent certain features from operating correctly.
        </p>
        <p>
          Where consent is required for non-essential technologies, we will seek it in accordance with applicable law.
        </p>
      </section>

      <section aria-labelledby="privacy-section-10">
        <h2 id="privacy-section-10">10. Sharing and Disclosure</h2>
        <p>
          We do not sell or rent participants' personal information.
        </p>
        <p>
          We may disclose limited information:
        </p>
        <ul>
          <li>To service providers acting on our behalf for hosting, infrastructure, email delivery, payment processing, or technical operations.</li>
          <li>To authorized administrators or personnel where necessary for platform administration, application review, support, or security.</li>
          <li>When participants intentionally publish information through public platform features.</li>
          <li>When required by applicable law, valid legal process, or lawful regulatory requests.</li>
          <li>When reasonably necessary to protect the security, rights, and integrity of the platform and its participants, subject to applicable law.</li>
        </ul>
        <p>
          Service providers are expected to handle information in accordance with applicable contractual and legal safeguards.
        </p>
      </section>

      <section aria-labelledby="privacy-section-11">
        <h2 id="privacy-section-11">11. International Data Processing</h2>
        <p>
          Humanity Union is established in Canada.
        </p>
        <p>
          Personal information may be processed or stored in Canada or other jurisdictions where our infrastructure and authorized service providers operate.
        </p>
        <p>
          Information processed outside a participant's country may be subject to the laws of the relevant jurisdiction.
        </p>
        <p>
          Where applicable law requires safeguards for international transfers, Humanity Union will use appropriate transfer mechanisms.
        </p>
      </section>

      <section aria-labelledby="privacy-section-12">
        <h2 id="privacy-section-12">12. Data Retention</h2>
        <p>
          We retain personal information only for as long as reasonably necessary for the purposes for which it was collected, including service operation, account administration, security, civic record integrity, dispute resolution, and applicable legal obligations.
        </p>
        <p>
          Retention periods may differ according to the type and purpose of information.
        </p>
        <p>
          Draft content, submitted applications, account records, private communications, public civic publications, financial records, and security logs may be subject to different retention considerations.
        </p>
        <p>
          Withdrawal of an application or termination of participation does not automatically erase all related records.
        </p>
        <p>
          When information is no longer reasonably required, we seek to delete, anonymize, or otherwise dispose of it securely, subject to applicable legal and operational requirements.
        </p>
        <p>
          Account deletion follows section 13. It does not, by itself, erase records that this section allows Humanity Union to retain, and retention of those records does not keep the closed account open. Closing an account does not mean that every retained record disappears at the same moment.
        </p>
      </section>

      <section aria-labelledby="privacy-section-13">
        <h2 id="privacy-section-13">13. Account Deletion and Privacy Requests</h2>
        <p>
          Participants may request deletion of their account or personal information by contacting <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a> or by using the account deletion control in Account Security when that control is available. Self-service deletion is not available for an administrator account, an account with an active regional appointment, or an account with an active editor permission. Those participants may still make the request by email.
        </p>
        <p>
          A self-service request is confirmed with the current password and a code sent to the account email. This confirms control of the account email. It does not verify legal identity. For any privacy request, Humanity Union may ask for reasonable information to confirm that the requester is authorized. That check is separate from ordinary participation and proportionate to the request.
        </p>
        <p>
          After confirmation, a recovery period of 30 days begins. The period runs for 720 hours from confirmation. During that period the participant cannot sign in. When three days or less remain and the account is not suspended, Humanity Union attempts to send one reminder. The reminder states the exact deadline and includes a link to the recovery page. Opening the link does not restore the account. A suspended account does not receive that reminder while the suspension lasts. If the suspension ends before the deadline and the reminder has not already been sent, Humanity Union may still attempt to send it. Delivery of the reminder is not guaranteed.
        </p>
        <p>
          Before the deadline, a participant whose account is not suspended may cancel the deletion on the recovery page by confirming the account email, the current password, and a new code. Cancellation restores sign-in. It does not add roles, appointments, editor permissions, or other privileges. Self-service recovery is unavailable while the account is suspended. Recovery becomes unavailable at the exact deadline.
        </p>
        <p>
          When the deadline passes, Humanity Union closes the account. Humanity Union attempts to send a closure notice to the account email before that address is released. Delivery of the notice is not guaranteed. A delivery failure does not extend the recovery deadline, and the closure still takes effect. Closing the account in Humanity Union's systems may take a short time after the deadline. Closure is not instantaneous. The closed account cannot be restored. Closure is not delayed by an administrative suspension.
        </p>
        <p>
          The same email address may be used to register a new account. The new account is a new participant. It does not receive the previous account’s identity, display name, roles, appointments, editor permissions, messages, or other privileges.
        </p>
        <p>
          Public civic records remain. The display name or pseudonym already associated with those records may remain so the records stay attributable. Account deletion does not rewrite civic documents. A participant may ask <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a> to anonymize or further restrict that name, or to request further restriction of other eligible personal information. Humanity Union will assess the request under this section and applicable law. Anonymization is not automatic.
        </p>
        <p>
          Private messages remain available to the other people in those conversations. The closed account cannot sign in or open them, and they are not transferred to a new account.
        </p>
        <p>
          At closure, Humanity Union disposes of credentials and profile details that are no longer required for the purposes below, including biography, photograph, organization, website, social links, and location. Disposal is secure and occurs when the information is no longer reasonably required. Closing the account does not mean that every item of personal information disappears at the same moment.
        </p>
        <p>
          Some information may still be retained, restricted, or anonymized rather than deleted, including information necessary for legal compliance, security, financial records, dispute resolution, or the integrity of public civic records. Retention of those records does not keep the account open and does not postpone release of the email address.
        </p>
        <p>
          An administrative suspension controls access. It does not cancel a confirmed deletion, extend the recovery deadline, or stop closure at that deadline. Closure does not lift the suspension. While an account is suspended, the participant cannot sign in or cancel the deletion on the recovery page. The participant may still contact <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a> about the request.
        </p>
        <p>
          Humanity Union will assess and respond to deletion and other privacy requests in accordance with applicable law. The rights in section 14, including access, correction, withdrawal of consent, deletion or anonymization of eligible information, objection, restriction, portability, and complaint to a privacy authority, are not reduced by this section.
        </p>
      </section>

      <section aria-labelledby="privacy-section-14">
        <h2 id="privacy-section-14">14. Your Privacy Rights</h2>
        <p>
          Depending on your jurisdiction and applicable law, you may have rights to:
        </p>
        <ul>
          <li>Request access to personal information held about you.</li>
          <li>Request correction of inaccurate or incomplete information.</li>
          <li>Withdraw consent where processing relies on consent.</li>
          <li>Request deletion or anonymization of eligible personal information.</li>
          <li>Object to or request restrictions on certain processing activities.</li>
          <li>Request data portability where legally applicable.</li>
          <li>Raise concerns with an appropriate privacy or data protection authority.</li>
        </ul>
        <p>
          Requests may be submitted to <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          We will respond in accordance with applicable legal requirements.
        </p>
      </section>

      <section aria-labelledby="privacy-section-15">
        <h2 id="privacy-section-15">15. Security Safeguards</h2>
        <p>
          Humanity Union uses administrative, technical, and organizational safeguards designed to protect information against unauthorized access, disclosure, alteration, loss, or misuse.
        </p>
        <p>
          These safeguards may include access controls, authentication protections, restricted administrative permissions, monitoring, and operational security measures.
        </p>
        <p>
          No online system can guarantee absolute security.
        </p>
        <p>
          Participants are encouraged to protect their account credentials and report suspected security incidents to <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section aria-labelledby="privacy-section-16">
        <h2 id="privacy-section-16">16. Third-Party Websites and Services</h2>
        <p>
          The platform may contain links to external websites, media, organizations, or services.
        </p>
        <p>
          These third parties may operate under their own privacy policies and practices. Humanity Union is not responsible for their independent processing activities.
        </p>
        <p>
          Participants should review the relevant privacy information before providing personal details to external services.
        </p>
      </section>

      <section aria-labelledby="privacy-section-17">
        <h2 id="privacy-section-17">17. Children's Privacy</h2>
        <p>
          Humanity Union does not knowingly seek to collect unnecessary personal information from children.
        </p>
        <p>
          Participation by minors, where permitted, is subject to applicable legal requirements and platform eligibility rules.
        </p>
        <p>
          Where legally required, appropriate consent or other safeguards must be obtained.
        </p>
        <p>
          If we become aware of personal information collected in circumstances that do not comply with applicable requirements, we will take appropriate steps to address the situation.
        </p>
      </section>

      <section aria-labelledby="privacy-section-18">
        <h2 id="privacy-section-18">18. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy to reflect changes in platform functionality, organizational practices, or applicable legal requirements.
        </p>
        <p>
          Material changes will be communicated through appropriate platform notices or other legally required methods.
        </p>
        <p>
          The effective date at the beginning of this document identifies the applicable published version.
        </p>
      </section>

      <section aria-labelledby="privacy-section-19">
        <h2 id="privacy-section-19">19. Contact Us</h2>
        <p>
          For questions, privacy requests, account deletion inquiries, or concerns regarding the processing of personal information, contact:
        </p>
        <p>
          <strong>{ORGANIZATION_NAME}</strong>
        </p>
        <p>
          514 Vernon St., Nelson, BC V1L 5R4, Canada
        </p>
        <p>
          <strong>Email:</strong> <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a>
        </p>
        <p>
          <strong>Website:</strong> {ORGANIZATION_WEBSITE}
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
