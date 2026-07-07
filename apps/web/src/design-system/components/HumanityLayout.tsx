import type { ReactNode } from "react";

import { HumanityFooter } from "./HumanityFooter";
import { HumanityHeader } from "./HumanityHeader";

interface HumanityLayoutProps {
  children: ReactNode;
}

export function HumanityLayout({ children }: HumanityLayoutProps) {
  return (
    <div className="humanity-layout">
      <HumanityHeader />
      <div className="humanity-layout__main">{children}</div>
      <HumanityFooter />
    </div>
  );
}
