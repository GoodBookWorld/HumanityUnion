export type MediaUploadPurpose = "avatar" | "initiative-image";

export interface MediaUploadResponse {
  mediaId: string;
  mediaUrl: string;
  mediaType: string;
  size: number;
  createdAt: string;
}
