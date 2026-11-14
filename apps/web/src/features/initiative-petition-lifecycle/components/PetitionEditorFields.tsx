"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { WorkspaceButton } from "../../initiative-workspace-ux";

export interface PetitionEditorFieldsValues {
  readonly title: string;
  readonly publicSummary: string;
  readonly requestStatement: string;
  readonly expectedOutcome: string;
  readonly supportingContext: string;
  readonly keyArguments: readonly string[];
  /** Shown only when defined (independent working drafts); one recipient per line. */
  readonly recipients?: readonly string[];
}

interface PetitionEditorFieldsProps {
  readonly values: PetitionEditorFieldsValues;
  readonly onChange: (patch: Partial<PetitionEditorFieldsValues>) => void;
  readonly disabled?: boolean;
}

/**
 * The Petition editor's form, shared by the single-draft Author Workspace
 * editor and the HU-LC-05C.4C.7C.2 working-draft editor.
 */
export function PetitionEditorFields({ values, onChange, disabled = false }: PetitionEditorFieldsProps) {
  const t = useTranslations("initiativeExperience");
  const idPrefix = useId();
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const { keyArguments } = values;

  function updateKeyArgument(index: number, value: string) {
    onChange({
      keyArguments: keyArguments.map((item, itemIndex) => (itemIndex === index ? value : item)),
    });
  }

  function removeKeyArgument(index: number) {
    onChange({ keyArguments: keyArguments.filter((_, itemIndex) => itemIndex !== index) });
  }

  function addKeyArgument() {
    onChange({ keyArguments: [...keyArguments, ""] });
  }

  return (
    <div className="ipl-editor__section">
      <div className="ipl-editor__field">
        <label htmlFor={fieldId("title")}>{t("author.petition.fields.title")}</label>
        <input
          id={fieldId("title")}
          value={values.title}
          disabled={disabled}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>

      <div className="ipl-editor__field">
        <label htmlFor={fieldId("public-summary")}>{t("author.petition.fields.publicSummary")}</label>
        <textarea
          id={fieldId("public-summary")}
          rows={3}
          value={values.publicSummary}
          disabled={disabled}
          onChange={(event) => onChange({ publicSummary: event.target.value })}
        />
      </div>

      <div className="ipl-editor__field">
        <label htmlFor={fieldId("request-statement")}>
          {t("author.petition.fields.requestStatement")}
        </label>
        <textarea
          id={fieldId("request-statement")}
          rows={3}
          value={values.requestStatement}
          disabled={disabled}
          onChange={(event) => onChange({ requestStatement: event.target.value })}
        />
      </div>

      <div className="ipl-editor__field">
        <label htmlFor={fieldId("expected-outcome")}>
          {t("author.petition.fields.expectedOutcome")}
        </label>
        <textarea
          id={fieldId("expected-outcome")}
          rows={3}
          value={values.expectedOutcome}
          disabled={disabled}
          onChange={(event) => onChange({ expectedOutcome: event.target.value })}
        />
      </div>

      <div className="ipl-editor__field">
        <label htmlFor={fieldId("supporting-context")}>
          {t("author.petition.fields.supportingContext")}
        </label>
        <textarea
          id={fieldId("supporting-context")}
          rows={4}
          value={values.supportingContext}
          disabled={disabled}
          onChange={(event) => onChange({ supportingContext: event.target.value })}
        />
      </div>

      <div className="ipl-editor__field">
        <label htmlFor={fieldId("key-arguments")}>{t("author.petition.fields.keyArguments")}</label>
        <div className="ipl-editor__key-arguments" id={fieldId("key-arguments")}>
          {keyArguments.map((argument, index) => (
            <div key={index} className="ipl-editor__key-argument">
              <textarea
                rows={2}
                value={argument}
                disabled={disabled}
                aria-label={t("author.petition.keyArguments.itemAria", { number: index + 1 })}
                onChange={(event) => updateKeyArgument(index, event.target.value)}
              />
              <WorkspaceButton
                variant="secondary"
                disabled={disabled}
                onClick={() => removeKeyArgument(index)}
              >
                {t("author.petition.keyArguments.remove")}
              </WorkspaceButton>
            </div>
          ))}
          <WorkspaceButton variant="secondary" disabled={disabled} onClick={addKeyArgument}>
            {t("author.petition.keyArguments.add")}
          </WorkspaceButton>
        </div>
      </div>

      {values.recipients ? (
        <div className="ipl-editor__field">
          <label htmlFor={fieldId("recipients")}>{t("petitionEditing.fields.recipients")}</label>
          <textarea
            id={fieldId("recipients")}
            rows={3}
            value={values.recipients.join("\n")}
            disabled={disabled}
            aria-describedby={fieldId("recipients-hint")}
            onChange={(event) => onChange({ recipients: event.target.value.split("\n") })}
          />
          <p id={fieldId("recipients-hint")} className="ipl-editor__hint">
            {t("petitionEditing.fields.recipientsHint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
