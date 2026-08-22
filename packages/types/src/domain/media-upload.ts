export type MediaUploadPurpose =
  | "avatar"
  | "initiative-image"
  | "blog-image"
  | "media-resource-logo";

export interface MediaUploadResponse {
  mediaId: string;
  mediaUrl: string;
  mediaType: string;
  size: number;
  createdAt: string;
}
