import Image from "next/image";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { CONTACT_EMAIL, mailtoContactLink } from "../../public-experience/footer-links";
import {
  SUPPORT_DONATE_URL,
  SUPPORT_ILLUSTRATIONS,
  SUPPORT_REGIONAL_PROGRAM_URL,
} from "../support.constants";

import "../support-page.css";

function ExternalButtonLink({
  href,
  variant = "primary",
  children,
  ariaLabel,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: string;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      className={`hu-button hu-button--${variant}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? `${children} (opens in a new tab)`}
    >
      {children}
    </a>
  );
}

export function SupportPageContent() {
  return (
    <div className="support-page">
      <header className="support-page__hero">
        <div className="support-page__hero-copy">
          <h1 className="support-page__title">Support Humanity Union</h1>
          <p className="support-page__subtitle">
            Help build better conditions for thoughtful collective action.
          </p>
          <div className="support-page__lede">
            <p>
              Humanity Union is developing an open platform where people can understand problems,
              examine evidence, improve proposals, make transparent decisions, and follow their
              implementation.
            </p>
            <p>
              Supporting the project helps us expand the tools, knowledge, and communities that make
              more responsible and lasting solutions possible.
            </p>
          </div>
          <p className="support-page__statement">
            You can support Humanity Union with resources, your time, or by helping build a local
            community.
          </p>
        </div>
        <div className="support-page__hero-media">
          <Image
            src={SUPPORT_ILLUSTRATIONS.hero}
            alt=""
            width={320}
            height={240}
            className="support-page__hero-image"
            priority
          />
        </div>
      </header>

      <section
        id="support-ways"
        className="support-page__section"
        aria-labelledby="support-ways-heading"
      >
        <h2 id="support-ways-heading" className="support-page__section-heading">
          Ways to support
        </h2>
        <div className="support-page__cards">
          <Card className="support-page__card">
            <Image
              src={SUPPORT_ILLUSTRATIONS.resources}
              alt=""
              width={44}
              height={44}
              className="support-page__card-icon"
              unoptimized
            />
            <h3 className="support-page__card-title">Support the Project</h3>
            <p className="support-page__card-body">
              Help fund platform development, infrastructure, educational resources, translation,
              and public-interest projects.
            </p>
            <div className="support-page__card-actions">
              <ExternalButtonLink href={SUPPORT_DONATE_URL}>Donate</ExternalButtonLink>
            </div>
            <p className="support-page__note">
              Donations support the development and operation of Humanity Union.
            </p>
          </Card>

          <Card className="support-page__card">
            <Image
              src={SUPPORT_ILLUSTRATIONS.participation}
              alt=""
              width={44}
              height={44}
              className="support-page__card-icon"
              unoptimized
            />
            <h3 className="support-page__card-title">Volunteer</h3>
            <p className="support-page__card-body">
              Contribute your time, knowledge, professional skills, research, translation,
              communication, organization, or community experience.
            </p>
            <div className="support-page__card-actions">
              <Button disabled aria-label="Volunteer with Humanity Union (coming soon)">
                Volunteer with Humanity Union
              </Button>
            </div>
            <p className="support-page__note">Volunteer applications will open here soon.</p>
          </Card>

          <Card className="support-page__card">
            <Image
              src={SUPPORT_ILLUSTRATIONS.regional}
              alt=""
              width={44}
              height={44}
              className="support-page__card-icon"
              unoptimized
            />
            <h3 className="support-page__card-title">Build a Regional Representation</h3>
            <p className="support-page__card-body">
              Help bring Humanity Union into your country or region. Regional representations
              connect local knowledge and priorities with global cooperation while keeping
              participation rooted in local communities.
            </p>
            <div className="support-page__card-actions">
              {/* TODO: Replace with internal Humanity Union Regional Program when available. */}
              <ExternalButtonLink href={SUPPORT_REGIONAL_PROGRAM_URL} variant="secondary">
                Regional Program
              </ExternalButtonLink>
            </div>
          </Card>
        </div>
      </section>

      <section className="support-page__section" aria-labelledby="why-support-heading">
        <Card className="support-page__why">
          <div className="support-page__why-copy">
            <h2 id="why-support-heading" className="support-page__section-heading">
              Why Support Matters
            </h2>
            <p className="support-page__body">
              Technology can do more than compete for attention.
            </p>
            <p className="support-page__body">
              It can help people understand complexity, compare alternatives, learn from one
              another, and carry decisions through to measurable results.
            </p>
            <p className="support-page__body">Humanity Union is being built around that purpose.</p>
            <p className="support-page__body">
              As the platform grows, more people and communities can participate in structured
              discussion, develop better proposals, preserve the reasoning behind decisions, and
              learn from their outcomes.
            </p>
            <p className="support-page__body">
              Supporting Humanity Union means helping create an environment where participation can
              become more informed, cooperation more practical, and collective decisions more
              transparent and durable.
            </p>
          </div>
          <div className="support-page__why-media">
            <Image
              src={SUPPORT_ILLUSTRATIONS.cooperation}
              alt=""
              width={240}
              height={180}
              className="support-page__why-image"
            />
          </div>
        </Card>
      </section>

      <section
        className="support-page__section"
        aria-labelledby="support-forms-heading"
      >
        <h2 id="support-forms-heading" className="support-page__section-heading">
          Every form of support matters differently
        </h2>
        <div className="support-page__blocks">
          <Card className="support-page__block">
            <h3 className="support-page__block-title">Resources</h3>
            <p className="support-page__block-body">Help build and maintain the platform.</p>
          </Card>
          <Card className="support-page__block">
            <h3 className="support-page__block-title">Participation</h3>
            <p className="support-page__block-body">
              Contribute knowledge, experience, and practical work.
            </p>
          </Card>
          <Card className="support-page__block">
            <h3 className="support-page__block-title">Regional Communities</h3>
            <p className="support-page__block-body">
              Connect local communities with global cooperation.
            </p>
          </Card>
        </div>
        <div className="support-page__closing-actions">
          <Button href="#support-ways" variant="primary">
            Choose how you want to contribute
          </Button>
        </div>
        <p className="support-page__contact">
          Questions about supporting the project? Email{" "}
          <a href={mailtoContactLink("Support")}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </div>
  );
}
