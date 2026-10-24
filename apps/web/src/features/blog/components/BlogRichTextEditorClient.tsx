import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  LinkImage,
  List,
  Paragraph,
  Table,
  TableToolbar,
  Underline,
  Undo,
  type EditorConfig,
} from "ckeditor5";
import { useMemo } from "react";

import { BlogEmojiPlugin, BLOG_EMOJI_TOOLBAR_ITEM } from "../blog-emoji-plugin";
import { BlogInlineIconPlugin, BLOG_INLINE_ICON_TOOLBAR_ITEM } from "../blog-inline-icon-plugin";
import { BlogCkeditorUploadAdapterPlugin } from "../ckeditor-upload-adapter";

import "ckeditor5/ckeditor5.css";

export interface BlogRichTextEditorClientProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  labelledBy?: string;
  placeholder?: string;
}

/**
 * Pack 15B — CKEditor 5 Classic editor (browser-only).
 * Pack 22C.1 — ImageResize (%, drag handles) + configured image styles.
 * Pack 22G — local Unicode emoji picker + inline icon upload (Blog media path).
 * Loaded via next/dynamic `{ ssr: false }` from BlogRichTextEditor.
 */
export function BlogRichTextEditorClient({
  value,
  onChange,
  disabled = false,
  labelledBy,
  placeholder = "Write your article…",
}: BlogRichTextEditorClientProps) {
  const licenseKey = process.env.NEXT_PUBLIC_CKEDITOR_LICENSE_KEY?.trim() || "GPL";

  const config = useMemo<EditorConfig>(
    () => ({
      licenseKey,
      placeholder,
      plugins: [
        Essentials,
        Paragraph,
        Heading,
        Bold,
        Italic,
        Underline,
        Link,
        LinkImage,
        List,
        BlockQuote,
        Alignment,
        Image,
        ImageToolbar,
        ImageCaption,
        ImageStyle,
        ImageResize,
        ImageUpload,
        HorizontalLine,
        Table,
        TableToolbar,
        Undo,
        BlogCkeditorUploadAdapterPlugin,
        BlogEmojiPlugin,
        BlogInlineIconPlugin,
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
          "blockQuote",
          "|",
          "alignment",
          "|",
          "uploadImage",
          BLOG_INLINE_ICON_TOOLBAR_ITEM,
          BLOG_EMOJI_TOOLBAR_ITEM,
          "insertTable",
          "horizontalLine",
        ],
        shouldNotGroupWhenFull: true,
      },
      heading: {
        options: [
          { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
          {
            model: "heading2",
            view: "h2",
            title: "Heading 2",
            class: "ck-heading_heading2",
          },
          {
            model: "heading3",
            view: "h3",
            title: "Heading 3",
            class: "ck-heading_heading3",
          },
        ],
      },
      /**
       * Font-family / free-form font-size are intentionally omitted.
       * Design tokens mandate `--hu-font-family` (system stack only).
       * Typography control = Paragraph / Heading 2 / Heading 3 presets.
       */
      image: {
        toolbar: [
          "resizeImage",
          "|",
          "imageStyle:wrapText",
          {
            name: "imageStyle:blockLayout",
            title: "Break text",
            items: [
              "imageStyle:alignBlockLeft",
              "imageStyle:alignCenter",
              "imageStyle:alignBlockRight",
              "imageStyle:full",
            ],
            defaultItem: "imageStyle:alignCenter",
          },
          "|",
          "toggleImageCaption",
          "imageTextAlternative",
          "linkImage",
        ],
        styles: {
          options: [
            "inline",
            "block",
            "side",
            {
              name: "alignLeft",
              title: "Wrap left",
              icon: "inlineLeft",
              className: "image-style-align-left",
              modelElements: ["imageBlock", "imageInline"],
            },
            {
              name: "alignRight",
              title: "Wrap right",
              icon: "inlineRight",
              className: "image-style-align-right",
              modelElements: ["imageBlock", "imageInline"],
            },
            {
              name: "alignBlockLeft",
              title: "Block left",
              icon: "left",
              className: "image-style-block-align-left",
              modelElements: ["imageBlock"],
            },
            {
              name: "alignCenter",
              title: "Block center",
              icon: "center",
              className: "image-style-align-center",
              modelElements: ["imageBlock"],
            },
            {
              name: "alignBlockRight",
              title: "Block right",
              icon: "right",
              className: "image-style-block-align-right",
              modelElements: ["imageBlock"],
            },
            {
              name: "full",
              title: "Full width",
              icon: "full",
              className: "image-style-block",
              modelElements: ["imageBlock"],
            },
          ],
        },
        // Percentage resize only (matches sanitizeBlogHtml). Drag handles stay on ImageResize.
        resizeUnit: "%",
        resizeOptions: [
          { name: "resizeImage:original", label: "Original", value: null, icon: "original" },
          { name: "resizeImage:25", label: "25%", value: "25", icon: "small" },
          { name: "resizeImage:50", label: "50%", value: "50", icon: "medium" },
          { name: "resizeImage:100", label: "100%", value: "100", icon: "large" },
          { name: "resizeImage:custom", label: "Custom", value: "custom", icon: "custom" },
        ],
      },
      table: {
        contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
      },
      link: {
        addTargetToExternalLinks: true,
        defaultProtocol: "https://",
      },
    }),
    [licenseKey, placeholder],
  );

  return (
    <div
      className="blog-rich-text blog-rich-text--ckeditor"
      aria-labelledby={labelledBy}
      data-disabled={disabled ? "true" : undefined}
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
      <p className="blog-rich-text__status hu-caption">
        Upload image for illustrations; Inline icon for in-flow icons (JPEG/PNG/WEBP/GIF). Emoji
        inserts Unicode text. Cover image stays in Publication settings.
      </p>
    </div>
  );
}
