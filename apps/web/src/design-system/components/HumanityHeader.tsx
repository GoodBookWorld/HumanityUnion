"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PRIMARY_NAVIGATION } from "../../features/public-experience/constants";

type PrimaryDestination = (typeof PRIMARY_NAVIGATION)[number]["label"];

function resolveCurrentDestination(pathname: string): PrimaryDestination {
  if (pathname.startsWith("/initiatives")) {
    return "Initiatives";
  }

  return "Home";
}

interface HumanityHeaderProps {
  currentDestination?: PrimaryDestination;
}

export function HumanityHeader({ currentDestination }: HumanityHeaderProps) {
  const pathname = usePathname();
  const activeDestination = currentDestination ?? resolveCurrentDestination(pathname);

  return (
    <header className="humanity-header" data-block="Header">
      <div className="humanity-header__inner">
        <div className="humanity-header__row">
          <div className="humanity-header__brand">
            <Link href="/">Humanity Union</Link>
          </div>
          <nav className="humanity-header__nav" aria-label="Primary navigation">
            <ul className="humanity-header__nav-list">
              {PRIMARY_NAVIGATION.map((item) => {
                const isCurrent = item.label === activeDestination;

                if (item.status === "placeholder") {
                  return (
                    <li key={item.label}>
                      <span
                        className="humanity-header__nav-placeholder"
                        aria-disabled="true"
                        title={`${item.label} — coming soon`}
                      >
                        {item.label}
                        <span className="humanity-header__nav-placeholder-note">
                          {" "}
                          (coming soon)
                        </span>
                      </span>
                    </li>
                  );
                }

                if (!item.href) {
                  return null;
                }

                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="humanity-header__nav-link"
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
      </div>
    </header>
  );
}
