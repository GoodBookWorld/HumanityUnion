import type { ReactNode } from "react";

import { BetaBanner } from "../../features/closed-beta/components/BetaBanner";
import { HumanityFooter } from "./HumanityFooter";
import { HumanityHeader } from "./HumanityHeader";

import "../../features/closed-beta/closed-beta.css";

interface HumanityLayoutProps {
  children: ReactNode;
}

export function HumanityLayout({ children }: HumanityLayoutProps) {
  return (
    <div className="humanity-layout">
      <a href="#main-content" className="hu-skip-link">
        Skip to main content
      </a>
      <BetaBanner />
      <HumanityHeader />
      <div className="humanity-layout__main" id="main-content">
        {children}
      </div>
      <HumanityFooter />
    </div>
  );
}
