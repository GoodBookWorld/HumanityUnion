"use client";

import type { ReactNode } from "react";

import { HumanityUnionAssistantProvider } from "../assistant-context";
import { HumanityUnionAssistantFloatingButton } from "./HumanityUnionAssistantFloatingButton";
import { HumanityUnionAssistantHost } from "./HumanityUnionAssistantHost";

export function HumanityUnionAssistantShell({ children }: { readonly children: ReactNode }) {
  return (
    <HumanityUnionAssistantProvider>
      {children}
      <HumanityUnionAssistantHost />
      <HumanityUnionAssistantFloatingButton />
    </HumanityUnionAssistantProvider>
  );
}
