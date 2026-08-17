"use client";

import { useState } from "react";

import type { InitiativePetitionDraft } from "@hu/types";

import { TranslateDraftControl } from "../../language";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../../member-profile/use-save-button-phase";
import { WorkspaceButton } from "../../initiative-workspace-ux";
import {
  generateInitiativePetitionDraft,
  publishInitiativePetitionStage,
  saveInitiativePetitionDraft,
} from "../api";

interface InitiativePetitionEditorProps {
  readonly initiativeId: string;
  readonly draft: InitiativePetitionDraft;
  readonly onDraftUpdated: (draft: InitiativePetitionDraft) => void;
  readonly onPublished: () => void;
  readonly onTogglePreview: () => void;
}

/**
 * Initiative Lifecycle — Part F, Section 3/6 (Petition Draft Builder /
 * Petition Workspace).
 *
 * The Author's editable working Petition draft: Generate (deterministic
 * Petition Builder — recomputes every suggested field from the current
 * Intelligence Snapshot, replacing prior generated values), free-text
 * Title / Public Summary / Request Statement / Expected Outcome /
 * Supporting Context / Key Arguments fields the Author freely edits
 * afterward, and Save Draft / Preview / Publish actions. No AI publishes
 * automatically and no signatures are pre-created — Publish is always an
 * explicit Author action.
 */
export function InitiativePetitionEditor({
  initiativeId,
  draft,
  onDraftUpdated,
  onPublished,
  onTogglePreview,
}: InitiativePetitionEditorProps) {
  const [title, setTitle] = useState(draft.title);
  const [publicSummary, setPublicSummary] = useState(draft.publicSummary);
  const [requestStatement, setRequestStatement] = useState(draft.requestStatement);
  const [expectedOutcome, setExpectedOutcome] = useState(draft.expectedOutcome);
  const [supportingContext, setSupportingContext] = useState(draft.supportingContext);
  const [keyArguments, setKeyArguments] = useState<string[]>(draft.keyArguments);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const generatePhase = useSaveButtonPhase();
  const savePhase = useSaveButtonPhase();
  const publishPhase = useSaveButtonPhase();
  const isBusy = generatePhase.isBusy || savePhase.isBusy || publishPhase.isBusy;

  function applyDraftToFields(updated: InitiativePetitionDraft) {
    setTitle(updated.title);
    setPublicSummary(updated.publicSummary);
    setRequestStatement(updated.requestStatement);
    setExpectedOutcome(updated.expectedOutcome);
    setSupportingContext(updated.supportingContext);
    setKeyArguments(updated.keyArguments);
    onDraftUpdated(updated);
  }

  function updateKeyArgument(index: number, value: string) {
    setKeyArguments((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function removeKeyArgument(index: number) {
    setKeyArguments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addKeyArgument() {
    setKeyArguments((current) => [...current, ""]);
  }

  async function handleGenerate() {
    setMessage(null);

    try {
      const updated = await generatePhase.runSave(() => generateInitiativePetitionDraft(initiativeId));
      applyDraftToFields(updated);
      setMessage({
        tone: "success",
        text: "Draft rebuilt from the Petition Sources. Review and edit before Publish.",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Generate failed: ${detail}` });
    }
  }

  async function handleSave(): Promise<boolean> {
    setMessage(null);

    try {
      const updated = await savePhase.runSave(() =>
        saveInitiativePetitionDraft(initiativeId, {
          title,
          publicSummary,
          requestStatement,
          expectedOutcome,
          supportingContext,
          keyArguments: keyArguments.filter((argument) => argument.trim().length > 0),
        }),
      );
      applyDraftToFields(updated);
      setMessage({ tone: "success", text: "Petition draft saved." });
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Save failed: ${detail}` });
      return false;
    }
  }

  function unresolvedPublishRequirements(): string[] {
    const missing: string[] = [];
    if (!title.trim()) missing.push("Petition title");
    if (!publicSummary.trim()) missing.push("Public summary");
    if (!requestStatement.trim()) missing.push("Request statement");
    if (!expectedOutcome.trim()) missing.push("Expected outcome");
    if (!draft.revisionId || draft.revisionVersion === null) {
      missing.push("Generate from a published Revision (required reference)");
    }
    return missing;
  }

  async function handlePublish() {
    const missing = unresolvedPublishRequirements();
    if (missing.length > 0) {
      setMessage({
        tone: "error",
        text: `Publish blocked — complete required fields first: ${missing.join("; ")}.`,
      });
      return;
    }

    if (
      !window.confirm(
        "Publishing creates the canonical Public Petition, opens it for signatures, notifies every Active Ally, and unlocks the Decision Session stage. Continue?",
      )
    ) {
      return;
    }

    setMessage(null);

    try {
      // Phase 04 — Save must succeed before Publish; never publish on a failed/stale save.
      const saved = await handleSave();
      if (!saved) {
        return;
      }

      await publishPhase.runSave(() => publishInitiativePetitionStage(initiativeId));
      setMessage({ tone: "success", text: "Petition published. Active Allies have been notified." });
      onPublished();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setMessage({ tone: "error", text: `Publish failed: ${detail}` });
    }
  }

  return (
    <div className="ipl-editor" aria-labelledby="ipl-editor-title">
      <div className="ipl-editor__header">
        <h3 id="ipl-editor-title">Petition Draft</h3>
      </div>

      <div className="ipl-editor__header-actions">
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleGenerate()}>
          {resolveSaveButtonLabel(generatePhase.phase, "Generate")}
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={onTogglePreview}>
          Preview
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" disabled={isBusy} onClick={() => void handleSave()}>
          {resolveSaveButtonLabel(savePhase.phase, "Save Draft")}
        </WorkspaceButton>
        <WorkspaceButton
          variant="primary"
          disabled={isBusy || unresolvedPublishRequirements().length > 0}
          onClick={() => void handlePublish()}
        >
          {resolveSaveButtonLabel(publishPhase.phase, "Publish Petition")}
        </WorkspaceButton>
      </div>

      {unresolvedPublishRequirements().length > 0 ? (
        <p className="ipl-editor__message" data-tone="error" role="status">
          Required before Publish: {unresolvedPublishRequirements().join("; ")}.
        </p>
      ) : null}

      {message ? (
        <p className="ipl-editor__message" data-tone={message.tone} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="ipl-editor__section">
        <div className="ipl-editor__field">
          <label htmlFor="ipl-title">Petition Title</label>
          <input id="ipl-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="ipl-editor__field">
          <label htmlFor="ipl-public-summary">Public Summary</label>
          <textarea
            id="ipl-public-summary"
            rows={3}
            value={publicSummary}
            onChange={(event) => setPublicSummary(event.target.value)}
          />
        </div>

        <div className="ipl-editor__field">
          <label htmlFor="ipl-request-statement">Request Statement</label>
          <textarea
            id="ipl-request-statement"
            rows={3}
            value={requestStatement}
            onChange={(event) => setRequestStatement(event.target.value)}
          />
        </div>

        <div className="ipl-editor__field">
          <label htmlFor="ipl-expected-outcome">Expected Outcome</label>
          <textarea
            id="ipl-expected-outcome"
            rows={3}
            value={expectedOutcome}
            onChange={(event) => setExpectedOutcome(event.target.value)}
          />
        </div>

        <div className="ipl-editor__field">
          <label htmlFor="ipl-supporting-context">Supporting Context</label>
          <textarea
            id="ipl-supporting-context"
            rows={4}
            value={supportingContext}
            onChange={(event) => setSupportingContext(event.target.value)}
          />
        </div>

        <div className="ipl-editor__field">
          <label htmlFor="ipl-key-arguments">Key Arguments</label>
          <div className="ipl-editor__key-arguments" id="ipl-key-arguments">
            {keyArguments.map((argument, index) => (
              <div key={index} className="ipl-editor__key-argument">
                <textarea
                  rows={2}
                  value={argument}
                  aria-label={`Key argument ${index + 1}`}
                  onChange={(event) => updateKeyArgument(index, event.target.value)}
                />
                <WorkspaceButton variant="secondary" onClick={() => removeKeyArgument(index)}>
                  Remove
                </WorkspaceButton>
              </div>
            ))}
            <WorkspaceButton variant="secondary" onClick={addKeyArgument}>
              Add Key Argument
            </WorkspaceButton>
          </div>
        </div>
      </div>

      <TranslateDraftControl
        sourceKind="petition"
        sourceRecordId={draft.draftId || `petition-draft-${initiativeId}`}
        sourceVersion={draft.updatedAt || draft.createdAt || "draft"}
        initiativeId={initiativeId}
        draftContent={{
          title,
          publicSummary,
          requestStatement,
          expectedOutcome,
          supportingContext,
          keyArguments: keyArguments.join("\n"),
        }}
        onApplyWorkingTranslation={(fields) => {
          if (fields.title) setTitle(fields.title);
          if (fields.publicSummary) setPublicSummary(fields.publicSummary);
          if (fields.requestStatement) setRequestStatement(fields.requestStatement);
          if (fields.expectedOutcome) setExpectedOutcome(fields.expectedOutcome);
          if (fields.supportingContext) setSupportingContext(fields.supportingContext);
          if (fields.keyArguments) {
            setKeyArguments(
              fields.keyArguments
                .split("\n")
                .map((entry) => entry.trim())
                .filter(Boolean),
            );
          }
        }}
      />
    </div>
  );
}
