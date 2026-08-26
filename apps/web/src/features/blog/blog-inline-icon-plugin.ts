/**
 * Pack 22G — insert a small Blog media image as an inline icon at the caret.
 *
 * Reuses FileRepository + BlogCkeditorUploadAdapter (same Blog media API / formats).
 * Does not create a parallel media system. Forces imageInline + empty decorative alt
 * by default; authors can edit alt via the existing image toolbar.
 */
import {
  FileDialogButtonView,
  FileRepository,
  IconImage,
  Plugin,
  type Editor,
  type UploadResponse,
} from "ckeditor5";

export const BLOG_INLINE_ICON_TOOLBAR_ITEM = "insertInlineIcon";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

function resolveUploadedUrl(response: UploadResponse): string | null {
  if (!response || typeof response !== "object") {
    return null;
  }
  const defaultUrl = (response as { default?: unknown }).default;
  return typeof defaultUrl === "string" && defaultUrl.trim() ? defaultUrl.trim() : null;
}

function insertInlineIconImage(editor: Editor, src: string): void {
  const imageInline = editor.model.schema.isRegistered("imageInline");
  if (!imageInline) {
    return;
  }

  editor.model.change((writer) => {
    const selection = editor.model.document.selection;
    if (!selection.isCollapsed) {
      const end = selection.getLastPosition();
      if (end) {
        writer.setSelection(end);
      }
    }

    const imageElement = writer.createElement("imageInline", {
      src,
      alt: "",
    });

    editor.model.insertContent(imageElement);
  });

  editor.editing.view.focus();
}

async function uploadAndInsertInlineIcon(editor: Editor, file: File): Promise<void> {
  const fileRepository = editor.plugins.get(FileRepository);
  const loader = fileRepository.createLoader(file);
  if (!loader) {
    return;
  }

  try {
    const response = await loader.upload();
    const src = resolveUploadedUrl(response);
    if (!src) {
      return;
    }
    insertInlineIconImage(editor, src);
  } catch (error) {
    console.error("[blog-inline-icon] upload failed", error);
  } finally {
    fileRepository.destroyLoader(loader);
  }
}

export class BlogInlineIconPlugin extends Plugin {
  public static get pluginName() {
    return "BlogInlineIcon" as const;
  }

  public static get requires() {
    return [FileRepository] as const;
  }

  public init(): void {
    const editor = this.editor;
    const t = editor.t.bind(editor);

    editor.ui.componentFactory.add(BLOG_INLINE_ICON_TOOLBAR_ITEM, (locale) => {
      const view = new FileDialogButtonView(locale);
      view.set({
        acceptedType: ACCEPTED_TYPES,
        allowMultipleFiles: false,
        label: t("Inline icon"),
        icon: IconImage,
        tooltip: true,
      });

      view.on("done", (_eventInfo, files: FileList | File[]) => {
        const list = Array.from(files as ArrayLike<File>);
        const file = list[0];
        if (!file) {
          return;
        }
        void uploadAndInsertInlineIcon(editor, file);
      });

      return view;
    });
  }
}
