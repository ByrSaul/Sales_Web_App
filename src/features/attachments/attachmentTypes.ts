export type AttachmentStatus =
  | 'pending'
  | 'encoding'
  | 'uploading'
  | 'verifying'
  | 'ambiguous'
  | 'success'
  | 'failed';

/** Adjunto ya persistido y asociado a un pedido de venta. */
export type OrderAttachment = {
  companyId: string;
  salesOrderNumber: string;
  documentId: string;
  fileName: string;
  fileType: string;
  description: string;
  attachmentType: string;
  contentBase64: string;
};

/** Archivo local pendiente de cargar durante el envío del pedido. */
export type PendingAttachment = {
  localId: string;
  file: File;
  fileName: string;
  extension: string;
  description: string;
  status: AttachmentStatus;
  error: string;
  attempts: number;
};

/** Contrato de carga enviado al servicio de adjuntos. */
export type AttachmentUploadRequest = {
  dataAreaId: string;
  AttachmentDescription: string;
  SalesOrderNumber: string;
  FileType: string;
  DocumentAttachmentTypeCode: 'Imagen' | 'Archivo';
  FileName: string;
  Attachment: string;
};

export type AttachmentDto = Record<string, unknown>;
