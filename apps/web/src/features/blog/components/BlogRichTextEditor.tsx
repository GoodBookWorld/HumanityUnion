"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import { Button } from "../../../design-system/components/Button";

export interface BlogRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  labelledBy?: string;
  placeholder?: string;
}

/**
 * TipTap Community editor constrained to the Blog sanitizer allowlist.
 * Output is HTML; the API server remains the trust boundary.
 */
export function BlogRichTextEditor({
  value,
  onChange,
  disabled = false,
  labelledBy,
  placeholder = "Write your article…",
}: BlogRichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Image.configure({
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML());
    },
    editorProps: {
      attributes: {
        class: "blog-rich-text__content hu-prose",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const current = editor.getHTML();
    if (value !== current && (value || "") !== (current === "<p></p>" ? "" : current)) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="blog-rich-text blog-rich-text--loading">Loading editor…</div>;
  }

  function setLink() {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const next = window.prompt("Link URL", previous ?? "https://");
    if (next === null || !editor) {
      return;
    }
    const trimmed = next.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }

  function insertImage() {
    const url = window.prompt("Image URL (platform media HTTPS path)");
    if (!url?.trim() || !editor) {
      return;
    }
    editor.chain().focus().setImage({ src: url.trim(), alt: "" }).run();
  }

  return (
    <div className={`blog-rich-text${disabled ? " blog-rich-text--disabled" : ""}`}>
      <div className="blog-rich-text__toolbar" role="toolbar" aria-label="Article formatting">
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Blockquote"
          active={editor.isActive("blockquote")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton label="Link" active={editor.isActive("link")} disabled={disabled} onClick={setLink} />
        <ToolbarButton label="Image" active={false} disabled={disabled} onClick={insertImage} />
        <ToolbarButton
          label="Divider"
          active={false}
          disabled={disabled}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <ToolbarButton
          label="Undo"
          active={false}
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Redo"
          active={false}
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton(props: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={props.active ? "primary" : "tertiary"}
      className="blog-rich-text__tool"
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}
