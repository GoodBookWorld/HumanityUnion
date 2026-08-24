"use client";

import dynamic from "next/dynamic";

import type { BlogRichTextEditorClientProps } from "./BlogRichTextEditorClient";

export type BlogRichTextEditorProps = BlogRichTextEditorClientProps;

/**
 * Pack 15B — CKEditor must not evaluate on the server (DOM APIs).
 * Public Blog pages never import this module.
 */
export const BlogRichTextEditor = dynamic(
  () =>
    import("./BlogRichTextEditorClient").then((mod) => mod.BlogRichTextEditorClient),
  {
    ssr: false,
    loading: () => (
      <div className="blog-rich-text blog-rich-text--loading" role="status">
        Loading editor…
      </div>
    ),
  },
);
