import {
  CONTACT_EMAIL,
  ORGANIZATION_ADDRESS,
  ORGANIZATION_NAME,
  ORGANIZATION_WEBSITE,
  mailtoContactLink,
} from "../../features/public-experience/footer-links";

import "../../features/legal/legal-page.css";

const CONTACT_SUBJECTS = [
  { label: "General Inquiries", subject: "General inquiry" },
  { label: "Partnerships & Collaboration", subject: "Partnerships and collaboration" },
  { label: "Media & Press", subject: "Media and press" },
  { label: "Technical Support", subject: "Technical support" },
] as const;

export default function ContactPage() {
  return (
    <article className="contact-page">
      <h1>Contact</h1>
      <p className="contact-page__intro">
        For closed beta and early platform support, contact Humanity Union by email. Your message
        opens in your own email client — we do not store contact form submissions on the platform.
      </p>

      <div className="contact-page__details">
        <p>
          <strong>Email:</strong> <a href={mailtoContactLink()}>{CONTACT_EMAIL}</a>
        </p>
        <p>
          <strong>Organization:</strong> {ORGANIZATION_NAME}
        </p>
        <p>
          <strong>Address:</strong> {ORGANIZATION_ADDRESS}
        </p>
        <p>
          <strong>Website:</strong> <a href={ORGANIZATION_WEBSITE}>{ORGANIZATION_WEBSITE}</a>
        </p>
      </div>

      <section aria-labelledby="contact-subjects-heading">
        <h2 id="contact-subjects-heading">Choose a subject</h2>
        <div className="contact-page__subjects">
          {CONTACT_SUBJECTS.map((item) => (
            <a key={item.label} href={mailtoContactLink(item.subject)}>
              {item.label}
            </a>
          ))}
        </div>
      </section>

      <p className="contact-page__hint">
        Include enough context for us to route your message. For account or civic workspace issues,
        use the email address associated with your Humanity Union account when possible.
      </p>
    </article>
  );
}
