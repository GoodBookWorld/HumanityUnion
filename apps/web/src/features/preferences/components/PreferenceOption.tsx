import type { ReactNode } from "react";

import "./preference-option.css";

interface PreferenceOptionProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
}

export function PreferenceOption({ label, checked, onChange, name }: PreferenceOptionProps) {
  return (
    <label className="preference-option">
      <input
        type="checkbox"
        className="preference-option__input"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="preference-option__label">{label}</span>
    </label>
  );
}

interface PreferenceOptionGridProps {
  children: ReactNode;
  columns?: 1 | 2;
}

export function PreferenceOptionGrid({ children, columns = 1 }: PreferenceOptionGridProps) {
  return (
    <div
      className={`preference-option-grid${
        columns === 2 ? " preference-option-grid--two-column" : ""
      }`}
    >
      {children}
    </div>
  );
}
