import type { Editor, FileLoader, UploadAdapter, UploadResponse } from "ckeditor5";

import { uploadBlogImage } from "../media-upload/media-upload-api";

/**
 * Pack 15B — CKEditor FileRepository adapter → existing Blog media upload authority.
 * Does not use CKEditor Cloud / Easy Image.
 */
export class BlogCkeditorUploadAdapter implements UploadAdapter {
  private readonly loader: FileLoader;
  private aborted = false;

  constructor(loader: FileLoader) {
    this.loader = loader;
  }

  async upload(): Promise<UploadResponse> {
    const file = await this.loader.file;
    if (!file) {
      return Promise.reject(new Error("No file selected."));
    }
    if (this.aborted) {
      return Promise.reject(new Error("Upload aborted."));
    }

    const uploaded = await uploadBlogImage(file);
    if (this.aborted) {
      return Promise.reject(new Error("Upload aborted."));
    }

    return {
      default: uploaded.mediaUrl,
    };
  }

  abort(): void {
    this.aborted = true;
  }
}

/** CKEditor plugin factory wired into ClassicEditor `plugins`. */
export function BlogCkeditorUploadAdapterPlugin(editor: Editor): void {
  const fileRepository = editor.plugins.get("FileRepository");
  fileRepository.createUploadAdapter = (loader: FileLoader) =>
    new BlogCkeditorUploadAdapter(loader);
}
