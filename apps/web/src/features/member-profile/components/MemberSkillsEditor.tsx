"use client";

import { useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { MAX_MEMBER_SKILL_LABEL_LENGTH, MAX_MEMBER_SKILLS } from "../member-profile-limits";

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
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAddSkill(): void {
    const trimmed = normalizeSkillInput(draft);

    if (trimmed.length === 0) {
      return;
    }

    if (trimmed.length > MAX_MEMBER_SKILL_LABEL_LENGTH) {
      setError(`Each skill must be at most ${MAX_MEMBER_SKILL_LABEL_LENGTH} characters.`);
      return;
    }

    if (skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      setError("That skill is already listed.");
      setDraft("");
      return;
    }

    if (skills.length >= MAX_MEMBER_SKILLS) {
      setError(`You can add up to ${MAX_MEMBER_SKILLS} skills.`);
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
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const normalized = dedupeSkills(skills);
      onChange(normalized);
      await onSave(normalized);
      setSuccessMessage("Skills saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save skills.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="member-skills-editor" onSubmit={handleSubmit}>
      <div className="member-skills-editor__add-row">
        <label className="member-skills-editor__field">
          <span className="visually-hidden">Add skill</span>
          <input
            value={draft}
            disabled={disabled || saving}
            maxLength={MAX_MEMBER_SKILL_LABEL_LENGTH}
            placeholder="Add a skill"
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
          disabled={disabled || saving || draft.trim().length === 0}
          onClick={handleAddSkill}
        >
          Add
        </Button>
      </div>

      <p className="member-skills-editor__hint">
        {skills.length}/{MAX_MEMBER_SKILLS} skills · up to {MAX_MEMBER_SKILL_LABEL_LENGTH}{" "}
        characters each
      </p>

      {skills.length > 0 ? (
        <ul className="member-skills-editor__tags" aria-label="Skills">
          {skills.map((skill) => (
            <li key={skill} className="member-skills-editor__tag">
              <span>{skill}</span>
              <button
                type="button"
                className="member-skills-editor__remove"
                disabled={disabled || saving}
                aria-label={`Remove ${skill}`}
                onClick={() => handleRemoveSkill(skill)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="member-skills-editor__empty">No skills added yet.</p>
      )}

      {error ? (
        <p className="member-skills-editor__error" role="alert">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="member-skills-editor__success" role="status">
          {successMessage}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={disabled || saving}>
        {saving ? "Saving..." : "Save skills"}
      </Button>
    </form>
  );
}
