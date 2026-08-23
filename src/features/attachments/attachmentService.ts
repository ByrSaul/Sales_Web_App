import type { ApiClient } from '../../core/api/apiClient';
import { mapAttachment, mapAttachmentList } from './attachmentMappers';
import { extensionOf } from './attachmentValidation';
import type { AttachmentDto, AttachmentUploadRequest, OrderAttachment } from './attachmentTypes';

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(file);
  });

export const attachmentService = (api: ApiClient) => ({
  list: async (companyId: string, salesOrderNumber: string): Promise<OrderAttachment[]> =>
    mapAttachmentList(
      await api.get<unknown>('/d365/sales_header_documents_atachments', {
        body: {
          filters: { dataAreaId: companyId, SalesOrderNumber: salesOrderNumber },
          cross_company: true,
          page: 1,
          perpage: 20,
        },
      }),
    ),
  upload: async (
    companyId: string,
    salesOrderNumber: string,
    file: File,
    description: string,
  ): Promise<OrderAttachment> => {
    const extension = extensionOf(file.name);
    const baseName = file.name.slice(0, -(extension.length + 1));
    const request: AttachmentUploadRequest = {
      dataAreaId: companyId,
      AttachmentDescription: description.trim(),
      SalesOrderNumber: salesOrderNumber,
      FileType: extension,
      DocumentAttachmentTypeCode: ['jpg', 'jpeg', 'png'].includes(extension) ? 'Imagen' : 'Archivo',
      FileName: baseName,
      Attachment: await fileToBase64(file),
    };
    const response = await api.post<AttachmentDto | AttachmentDto[]>(
      '/d365/sales_header_documents_atachments',
      request,
      { timeoutMs: 120_000 },
    );
    return mapAttachment(Array.isArray(response) ? (response[0] ?? {}) : response);
  },
});

const mime: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};
export const safeDownloadName = (name: string, extension: string) =>
  `${name.replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f]/g, '') || 'archivo'}${name.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? '' : `.${extension}`}`;
export const openAttachment = (
  attachment: OrderAttachment,
  openWindow: (url: string) => Window | null = (url) => window.open(url, '_blank', 'noopener'),
) => {
  const binary = atob(attachment.contentBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: mime[attachment.fileType.toLowerCase()] || 'application/octet-stream',
    }),
  );
  const name = safeDownloadName(attachment.fileName, attachment.fileType);
  if (['pdf', 'png', 'jpg', 'jpeg'].includes(attachment.fileType.toLowerCase())) openWindow(url);
  else {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return name;
};
