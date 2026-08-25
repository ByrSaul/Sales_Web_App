import type { ApiClient } from '../../core/api/apiClient';
import { mapAttachment, mapAttachmentList } from './attachmentMappers';
import { extensionOf } from './attachmentValidation';
import type { AttachmentDto, AttachmentUploadRequest, OrderAttachment } from './attachmentTypes';

/**
 * Lee un archivo local y obtiene únicamente su contenido Base64.
 *
 * @param file Archivo seleccionado por el usuario.
 * @returns Contenido Base64 sin el prefijo Data URL.
 */
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

/**
 * Servicio de carga y consulta de adjuntos de pedidos.
 *
 * Endpoints utilizados:
 * - Endpoints D365 de creación y consulta de adjuntos de venta.
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operaciones para cargar y consultar archivos adjuntos.
 */
export const attachmentService = (api: ApiClient) => ({
  list: async (
    companyId: string,
    salesOrderNumber: string,
    signal?: AbortSignal,
  ): Promise<OrderAttachment[]> =>
    mapAttachmentList(
      await api.post<unknown>(
        '/d365/sales_header_documents_atachments/query',
        {
          filters: { dataAreaId: companyId, SalesOrderNumber: salesOrderNumber },
          cross_company: true,
          page: 1,
          perpage: 20,
        },
        { signal },
      ),
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
/** Construye un nombre de descarga seguro conservando la extensión informada. */
export const safeDownloadName = (name: string, extension: string) =>
  `${name.replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f]/g, '') || 'archivo'}${name.toLowerCase().endsWith(`.${extension.toLowerCase()}`) ? '' : `.${extension}`}`;
/**
 * Abre un adjunto Base64 en una nueva pestaña utilizando su tipo MIME conocido.
 *
 * @param content Contenido codificado en Base64.
 * @param extension Extensión utilizada para resolver el MIME.
 * @param fileName Nombre sugerido para el recurso.
 */
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
