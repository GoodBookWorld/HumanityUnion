"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  Underline,
  Undo,
  type EditorConfig,
} from "ckeditor5";
import { useMemo } from "react";

import "ckeditor5/ckeditor5.css";
import "./legal-rich-text-editor.css";

export interface LegalRichTextEditorClientProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  labelledBy?: string;
  placeholder?: string;
  /** Content language for a11y / spellcheck; does not auto-translate. */
  contentLanguage?: string;
  /** Document direction for RTL locales (ar/he). */
  textDirection?: "ltr" | "rtl";
  headingLabels?: {
    paragraph: string;
    heading2: string;
    heading3: string;
  };
}

/**
 * HU-LEGAL-EDITOR-01B — Restricted CKEditor 5 for Legal Localization only.
 * No images, uploads, emoji, tables, fonts, or colors.
 * Loaded via next/dynamic `{ ssr: false }` from LegalRichTextEditor.
 */
export function LegalRichTextEditorClient({
  value,
  onChange,
  disabled = false,
  labelledBy,
  placeholder = "Enter counsel-approved legal text…",
  contentLanguage = "en",
  textDirection = "ltr",
  headingLabels,
}: LegalRichTextEditorClientProps) {
  const licenseKey = process.env.NEXT_PUBLIC_CKEDITOR_LICENSE_KEY?.trim() || "GPL";

  const config = useMemo<EditorConfig>(
    () => ({
      licenseKey,
      placeholder,
      language: contentLanguage,
      plugins: [
        Essentials,
        Paragraph,
        Heading,
        Bold,
        Italic,
        Underline,
        Link,
        List,
        Undo,
      ],
      toolbar: {
        items: [
          "undo",
          "redo",
          "|",
          "heading",
          "|",
          "bold",
          "italic",
          "underline",
          "|",
          "link",
          "bulletedList",
          "numberedList",
        ],
        shouldNotGroupWhenFull: true,
      },
      heading: {
        options: [
          {
            model: "paragraph",
            title: headingLabels?.paragraph ?? "Paragraph",
            class: "ck-heading_paragraph",
          },
          {
            model: "heading2",
            view: "h2",
            title: headingLabels?.heading2 ?? "Heading 2",
            class: "ck-heading_heading2",
          },
          {
            model: "heading3",
            view: "h3",
            title: headingLabels?.heading3 ?? "Heading 3",
            class: "ck-heading_heading3",
          },
        ],
      },
      link: {
        addTargetToExternalLinks: true,
        defaultProtocol: "https://",
      },
    }),
    [licenseKey, placeholder, contentLanguage, headingLabels],
  );

  return (
    <div
      className="legal-rich-text legal-rich-text--ckeditor"
      aria-labelledby={labelledBy}
      data-disabled={disabled ? "true" : undefined}
      dir={textDirection}
      lang={contentLanguage}
    >
      <CKEditor
        editor={ClassicEditor}
        data={value || ""}
        disabled={disabled}
        config={config}
        onChange={(_event, editor) => {
          onChange(editor.getData());
        }}
      />
    </div>
  );
}
