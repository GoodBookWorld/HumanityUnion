"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { LegalRichTextEditorClientProps } from "./LegalRichTextEditorClient";

import "./legal-rich-text-editor.css";

export type LegalRichTextEditorProps = Omit<
  LegalRichTextEditorClientProps,
  "headingLabels" | "placeholder"
> & {
  placeholder?: string;
};

const LegalRichTextEditorLazy = dynamic(
  () =>
    import("./LegalRichTextEditorClient").then((mod) => mod.LegalRichTextEditorClient),
  { ssr: false },
);

/**
 * HU-LEGAL-EDITOR-01B — CKEditor must not evaluate on the server (DOM APIs).
 * Public legal pages never import this module.
 */
export function LegalRichTextEditor(props: LegalRichTextEditorProps) {
  const t = useTranslations("legalLocalizationAdmin");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="legal-rich-text legal-rich-text--loading" role="status">
        {t("editorLoading")}
      </div>
    );
  }

  return (
    <LegalRichTextEditorLazy
      {...props}
      placeholder={props.placeholder ?? t("placeholder")}
      headingLabels={{
        paragraph: t("headings.paragraph"),
        heading2: t("headings.heading2"),
        heading3: t("headings.heading3"),
      }}
    />
  );
}
