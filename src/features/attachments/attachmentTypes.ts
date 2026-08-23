export type AttachmentStatus = 'pending' | 'encoding' | 'uploading' | 'success' | 'failed';

export type OrderAttachment = {
  companyId: string; salesOrderNumber: string; documentId: string; fileName: string;
  fileType: string; description: string; attachmentType: string; contentBase64: string;
};

export type PendingAttachment = {
  localId: string; file: File; fileName: string; extension: string; description: string;
  status: AttachmentStatus; error: string; attempts: number;
};

export type AttachmentUploadRequest = {
  dataAreaId: string; AttachmentDescription: string; SalesOrderNumber: string;
  FileType: string; DocumentAttachmentTypeCode: 'Imagen' | 'Archivo'; FileName: string; Attachment: string;
};

export type AttachmentDto = Record<string, unknown>;
