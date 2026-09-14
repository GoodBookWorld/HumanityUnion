"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import "./password-input.css";

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Pack 02E Task 03 — Show/Hide chrome from `common.show` / `common.hide` and
 * accessible names from `common.showPassword` / `common.hidePassword`.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  disabled,
  className,
}: PasswordInputProps) {
  const tCommon = useTranslations("common");
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-input${className ? ` ${className}` : ""}`}>
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        aria-required={required || undefined}
        minLength={minLength}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="password-input__toggle"
        aria-label={visible ? tCommon("hidePassword") : tCommon("showPassword")}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? tCommon("hide") : tCommon("show")}
      </button>
    </div>
  );
}
