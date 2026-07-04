/** Evidence content stored or linked under platform policy within aggregate scope. */
export interface EvidenceAttachment {
  attachmentId: string;
  mediaType: string;
  displayLabel: string;
  storageReference: string | null;
}
