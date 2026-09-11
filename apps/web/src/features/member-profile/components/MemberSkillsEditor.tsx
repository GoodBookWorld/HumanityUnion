"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { MAX_MEMBER_SKILL_LABEL_LENGTH, MAX_MEMBER_SKILLS } from "../member-profile-limits";
import { resolveSaveButtonLabel, useSaveButtonPhase } from "../use-save-button-phase";

import "./member-skills-editor.css";

interface MemberSkillsEditorProps {
  skills: string[];
  disabled?: boolean;
  onChange: (skills: string[]) => void;
  onSave: (skills: string[]) => Promise<void>;
}

function normalizeSkillInput(value: string): string {
  return value.trim();
}

function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const skill of skills) {
    const trimmed = normalizeSkillInput(skill);

    if (trimmed.length === 0) {
      continue;
    }

    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

export function MemberSkillsEditor({
  skills,
  disabled = false,
  onChange,
  onSave,
}: MemberSkillsEditorProps) {
  const t = useTranslations("memberProfile.skills");
  const tSections = useTranslations("memberProfile.sections");
  const [draft, setDraft] = useState("");
  const { phase, isBusy, runSave } = useSaveButtonPhase();
  const [error, setError] = useState<string | null>(null);

  function handleAddSkill(): void {
    const trimmed = normalizeSkillInput(draft);

    if (trimmed.length === 0) {
      return;
    }

    if (trimmed.length > MAX_MEMBER_SKILL_LABEL_LENGTH) {
      setError(t("maxLength", { max: MAX_MEMBER_SKILL_LABEL_LENGTH }));
      return;
    }

    if (skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("duplicate"));
      setDraft("");
      return;
    }

    if (skills.length >= MAX_MEMBER_SKILLS) {
      setError(t("maxCount", { max: MAX_MEMBER_SKILLS }));
      return;
    }

    onChange([...skills, trimmed]);
    setDraft("");
    setError(null);
  }

  function handleRemoveSkill(skillToRemove: string): void {
    onChange(skills.filter((skill) => skill !== skillToRemove));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      await runSave(async () => {
        const normalized = dedupeSkills(skills);
        onChange(normalized);
        await onSave(normalized);
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("saveError"));
    }
  }

  return (
    <form className="member-skills-editor" onSubmit={handleSubmit}>
      <div className="member-skills-editor__add-row">
        <label className="member-skills-editor__field">
          <span className="hu-visually-hidden">{t("add")}</span>
          <input
            value={draft}
            disabled={disabled || isBusy}
            maxLength={MAX_MEMBER_SKILL_LABEL_LENGTH}
            placeholder={t("placeholder")}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddSkill();
              }
            }}
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || isBusy || draft.trim().length === 0}
          onClick={handleAddSkill}
        >
          {t("add")}
        </Button>
      </div>

      <p className="member-skills-editor__hint">
        {skills.length}/{MAX_MEMBER_SKILLS} skills · up to {MAX_MEMBER_SKILL_LABEL_LENGTH}{" "}
        characters each
      </p>

      {skills.length > 0 ? (
        <ul className="member-skills-editor__tags" aria-label={tSections("skills")}>
          {skills.map((skill) => (
            <li key={skill} className="member-skills-editor__tag">
              <span>{skill}</span>
              <button
                type="button"
                className="member-skills-editor__remove"
                disabled={disabled || isBusy}
                aria-label={`${t("remove")} ${skill}`}
                onClick={() => handleRemoveSkill(skill)}
              >
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="member-skills-editor__empty">{t("empty")}</p>
      )}

      {error ? (
        <p className="member-skills-editor__error" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={disabled || isBusy} ariaLive="polite">
        {resolveSaveButtonLabel(phase, t("save"))}
      </Button>
    </form>
  );
}
