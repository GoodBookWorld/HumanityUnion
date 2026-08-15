import type { Response } from "express";

import type { SharedDocumentDownloadTarget } from "./shared-documents.service.js";

/**
 * Communication UX Pack 03.7 Part 8 — the ONLY way a Shared Document's
 * bytes ever leave the server. No public URL is ever generated (there is
 * no `buildPublicUrl` for this module at all); every request reaches
 * this function only after `resolveSharedDocumentDownload` has already
 * re-verified the caller's context authorization. `Cache-Control:
 * private, no-store` prevents an intermediary proxy/CDN from ever
 * caching a private file, and `Content-Disposition: attachment` matches
 * Part 6 — "Download button... Never inline-edit."
 *
 * Production Deployment Pack 02 — stream may come from local disk or
 * private R2 GetObject; never from a public CDN URL.
 */
export async function streamSharedDocumentDownload(
  res: Response,
  target: SharedDocumentDownloadTarget,
): Promise<void> {
  res.setHeader("Content-Type", target.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeHeaderFileName(target.fileName)}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  try {
    const stream = await target.openReadStream();

    stream.on("error", () => {
      if (!res.headersSent) {
        res
          .status(404)
          .json({ success: false, data: null, meta: {}, links: {}, message: "Document not found." });
      }
    });

    stream.pipe(res);
  } catch {
    if (!res.headersSent) {
      res
        .status(404)
        .json({ success: false, data: null, meta: {}, links: {}, message: "Document not found." });
    }
  }
}

function sanitizeHeaderFileName(fileName: string): string {
  return fileName.replace(/["\r\n]/g, "");
}
