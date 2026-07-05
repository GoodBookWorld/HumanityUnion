import Link from "next/link";

import { PRIMARY_NAVIGATION } from "../constants";

interface PublicExperienceHeaderProps {
  currentDestination?: (typeof PRIMARY_NAVIGATION)[number]["label"];
}

export function PublicExperienceHeader({
  currentDestination = "Home",
}: PublicExperienceHeaderProps) {
  return (
    <header className="public-experience-header">
      <div className="public-experience-header__inner">
        <div className="public-experience-header__brand">
          <Link href="/">Humanity Union</Link>
        </div>
        <nav className="public-experience-header__nav" aria-label="Primary navigation">
          <ul className="public-experience-header__nav-list">
            {PRIMARY_NAVIGATION.map((item) => {
              const isCurrent = item.label === currentDestination;

              if (item.status === "placeholder") {
                return (
                  <li key={item.label}>
                    <span
                      className="public-experience-header__nav-placeholder"
                      aria-disabled="true"
                      title={`${item.label} — coming soon`}
                    >
                      {item.label}
                      <span className="public-experience-header__nav-placeholder-note">
                        {" "}
                        (coming soon)
                      </span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="public-experience-header__nav-link"
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
