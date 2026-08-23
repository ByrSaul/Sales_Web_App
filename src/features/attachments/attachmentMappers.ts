import type { AttachmentDto, OrderAttachment } from './attachmentTypes';
const text = (value: unknown) => (typeof value === 'string' ? value : '');
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
export const mapAttachmentList = (value: unknown): OrderAttachment[] =>
  Array.isArray(value) ? value.map((item) => mapAttachment(item as AttachmentDto)) : [];
