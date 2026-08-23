import type { ReactNode } from "react";

import { BetaBanner } from "../../features/closed-beta/components/BetaBanner";
import { HumanityUnionAssistantShell } from "../../features/humanity-union-assistant";
import { DocumentLanguageAttributes } from "../../features/language";
import { PwaShell } from "../../features/pwa/components/PwaShell";
import { TrafficPageviewCollector } from "../../features/traffic-analytics/TrafficPageviewCollector";
import { HumanityFooter } from "./HumanityFooter";
import { HumanityHeader } from "./HumanityHeader";

import "../../features/closed-beta/closed-beta.css";
import "../../features/pwa/pwa.css";

interface HumanityLayoutProps {
  children: ReactNode;
}

export function HumanityLayout({ children }: HumanityLayoutProps) {
  return (
    <HumanityUnionAssistantShell>
      <DocumentLanguageAttributes />
      <TrafficPageviewCollector />
      <PwaShell>
        <div className="humanity-layout">
          <a href="#main-content" className="hu-skip-link">
            Skip to main content
          </a>
          <BetaBanner />
          <HumanityHeader />
          {/*
            Skip-link target. Pages may still render an inner <main>; consolidating
            to a single document landmark is deferred so we do not redesign shells.
            tabIndex=-1 lets the skip link move keyboard focus here reliably.
          */}
          <div className="humanity-layout__main" id="main-content" tabIndex={-1}>
            {children}
          </div>
          <HumanityFooter />
        </div>
      </PwaShell>
    </HumanityUnionAssistantShell>
  );
}
