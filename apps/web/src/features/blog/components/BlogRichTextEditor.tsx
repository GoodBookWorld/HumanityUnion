"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { HelperText } from "../../../design-system/components/HelperText";
import { uploadBlogImage } from "../../media-upload/media-upload-api";

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
 * Pack 14C — sticky toolbar, caret inline image upload with alt text.
 */
export function BlogRichTextEditor({
  value,
  onChange,
  disabled = false,
  labelledBy,
  placeholder = "Write your article…",
}: BlogRichTextEditorProps) {
  const fileInputId = useId();
  const altInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

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
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
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

  function openInlineImageFlow() {
    setImageError(null);
    setImageAlt("");
    setPendingImageSrc(null);
    setImageDialogOpen(true);
  }

  async function handleInlineImageFile(file: File | undefined) {
    if (!file || disabled) {
      return;
    }
    setImageUploading(true);
    setImageError(null);
    try {
      const uploaded = await uploadBlogImage(file);
      setPendingImageSrc(uploaded.mediaUrl);
    } catch (uploadError) {
      setImageError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
      setPendingImageSrc(null);
    } finally {
      setImageUploading(false);
    }
  }

  function confirmInlineImage() {
    if (!editor || !pendingImageSrc) {
      return;
    }
    editor
      .chain()
      .focus()
      .setImage({ src: pendingImageSrc, alt: imageAlt.trim() })
      .run();
    setImageDialogOpen(false);
    setPendingImageSrc(null);
    setImageAlt("");
    setImageError(null);
  }

  function cancelInlineImage() {
    setImageDialogOpen(false);
    setPendingImageSrc(null);
    setImageAlt("");
    setImageError(null);
  }

  const wordCount = countWordsFromHtml(editor.getHTML());

  return (
    <div className={`blog-rich-text${disabled ? " blog-rich-text--disabled" : ""}`}>
      <div className="blog-rich-text__toolbar-sticky">
        <div className="blog-rich-text__toolbar" role="toolbar" aria-label="Article formatting">
          <ToolbarButton
            label="Paragraph"
            title="Paragraph"
            active={editor.isActive("paragraph") && !editor.isActive("heading")}
            disabled={disabled}
            onClick={() => editor.chain().focus().setParagraph().run()}
          />
          <ToolbarButton
            label="H2"
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="H3"
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarButton
            label="Bold"
            title="Bold"
            active={editor.isActive("bold")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="Italic"
            title="Italic"
            active={editor.isActive("italic")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="Underline"
            title="Underline"
            active={editor.isActive("underline")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            label="Quote"
            title="Blockquote"
            active={editor.isActive("blockquote")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            label="Bullets"
            title="Bulleted list"
            active={editor.isActive("bulletList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Numbers"
            title="Numbered list"
            active={editor.isActive("orderedList")}
            disabled={disabled}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="Link"
            title="Insert or edit link"
            active={editor.isActive("link")}
            disabled={disabled}
            onClick={setLink}
          />
          <ToolbarButton
            label="Left"
            title="Align left"
            active={editor.isActive({ textAlign: "left" })}
            disabled={disabled}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          />
          <ToolbarButton
            label="Center"
            title="Align center"
            active={editor.isActive({ textAlign: "center" })}
            disabled={disabled}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          />
          <ToolbarButton
            label="Right"
            title="Align right"
            active={editor.isActive({ textAlign: "right" })}
            disabled={disabled}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          />
          <ToolbarButton
            label="Image"
            title="Insert image at caret"
            active={false}
            disabled={disabled}
            onClick={openInlineImageFlow}
          />
          <ToolbarButton
            label="Divider"
            title="Horizontal divider"
            active={false}
            disabled={disabled}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <ToolbarButton
            label="Undo"
            title="Undo"
            active={false}
            disabled={disabled || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            label="Redo"
            title="Redo"
            active={false}
            disabled={disabled || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>
      </div>

      <EditorContent editor={editor} />

      <div className="blog-rich-text__status" aria-live="polite">
        {wordCount} {wordCount === 1 ? "word" : "words"}
      </div>

      {imageDialogOpen ? (
        <div
          className="blog-inline-image-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fileInputId}-title`}
        >
          <div className="blog-inline-image-dialog__panel">
            <h3 className="hu-heading-3" id={`${fileInputId}-title`}>
              Insert image
            </h3>
            <p className="hu-body">
              Upload a platform media image. It will be inserted at the current caret position in the
              article (separate from the cover image).
            </p>
            <div className="hu-form-actions">
              <label className="hu-button hu-button--secondary hu-button--sm" htmlFor={fileInputId}>
                {pendingImageSrc ? "Replace file" : "Choose image"}
              </label>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={disabled || imageUploading}
                onChange={(event) => {
                  void handleInlineImageFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            {imageUploading ? <HelperText>Uploading…</HelperText> : null}
            {pendingImageSrc ? (
              <p className="hu-caption blog-inline-image-dialog__src">Ready: media uploaded</p>
            ) : null}
            <label className="hu-label" htmlFor={altInputId}>
              Image description / alt text
            </label>
            <input
              id={altInputId}
              className="hu-form-control"
              type="text"
              maxLength={200}
              value={imageAlt}
              disabled={disabled || !pendingImageSrc}
              onChange={(event) => setImageAlt(event.target.value)}
              placeholder="Describe the image for accessibility"
            />
            <HelperText>
              Visible accessibility field. Do not leave blank when the image conveys meaning. Alt
              text is never auto-generated.
            </HelperText>
            {imageError ? (
              <p className="hu-body" role="alert">
                {imageError}
              </p>
            ) : null}
            <div className="hu-form-actions">
              <Button
                type="button"
                variant="primary"
                disabled={!pendingImageSrc || imageUploading}
                onClick={confirmInlineImage}
              >
                Insert at caret
              </Button>
              <Button type="button" variant="tertiary" onClick={cancelInlineImage}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function countWordsFromHtml(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return 0;
  }
  return text.split(" ").filter(Boolean).length;
}

function ToolbarButton(props: {
  label: string;
  title: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <span title={props.title} className="blog-rich-text__tool-wrap">
      <Button
        type="button"
        variant={props.active ? "primary" : "tertiary"}
        className="blog-rich-text__tool"
        aria-label={props.title}
        aria-pressed={props.active}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.label}
      </Button>
    </span>
  );
}
