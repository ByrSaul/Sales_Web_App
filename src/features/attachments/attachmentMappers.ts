import type { AttachmentDto, OrderAttachment } from "./attachmentTypes";
const text = (value: unknown) => (typeof value === "string" ? value : "");
/** Convierte un adjunto de D365 al modelo descargable de la aplicación. */
export const mapAttachment = (dto: AttachmentDto): OrderAttachment => ({
  companyId: text(dto.dataAreaId),
  salesOrderNumber: text(dto.SalesOrderNumber),
  documentId: text(dto.DocumentId),
  fileName: text(dto.FileName),
  fileType: text(dto.FileType),
  description: text(dto.AttachmentDescription),
  attachmentType: text(dto.DocumentAttachmentTypeCode),
  contentBase64: text(dto.Attachment),
});
export const mapAttachmentList = (value: unknown): OrderAttachment[] => {
  let records: unknown[] = [];
  if (Array.isArray(value)) records = value;
  else {
    const wrapped = (value as Record<string, unknown> | null)?.["@odata"];
    if (Array.isArray(wrapped)) records = wrapped;
  }
  return records.map((item) => mapAttachment(item as AttachmentDto));
};
