
import type { ApiClient } from "../../core/api/apiClient";
import { mapAttachment, mapAttachmentList } from "./attachmentMappers";
import { extensionOf } from "./attachmentValidation";
import type {
  AttachmentDto,
  AttachmentUploadRequest,
  OrderAttachment,
} from "./attachmentTypes";

/**
 * Lee un archivo local y obtiene únicamente su contenido Base64.
 *
 * @param file Archivo seleccionado por el usuario.
 * @returns Contenido Base64 sin el prefijo Data URL.
 */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("No se pudo leer el archivo."));
    };

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("El resultado del archivo no es válido."));
        return;
      }

      const separatorIndex = result.indexOf(",");

      if (separatorIndex === -1) {
        reject(new Error("El formato del archivo no es válido."));
        return;
      }

      resolve(result.slice(separatorIndex + 1));
    };

    reader.readAsDataURL(file);
  });

/**
 * Servicio de carga y consulta de adjuntos de pedidos.
 *
 * Endpoints utilizados:
 * - POST /d365/sales_header_documents_atachments/query
 * - POST /d365/sales_header_documents_atachments
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operaciones para cargar y consultar archivos adjuntos.
 */
export const attachmentService = (api: ApiClient) => ({
  /**
   * Consulta los archivos adjuntos de un pedido.
   */
  list: async (
    companyId: string,
    salesOrderNumber: string,
    signal?: AbortSignal,
  ): Promise<OrderAttachment[]> => {
    const response = await api.post<unknown>(
      "/d365/sales_header_documents_atachments/query",
      {
        filters: {
          dataAreaId: companyId,
          SalesOrderNumber: salesOrderNumber,
        },
        cross_company: true,
        page: 1,
        perpage: 20,
      },
      { signal },
    );

    return mapAttachmentList(response);
  },

  /**
   * Carga un archivo adjunto en Dynamics 365.
   */
  upload: async (
    companyId: string,
    salesOrderNumber: string,
    file: File,
    description: string,
  ): Promise<OrderAttachment> => {
    const extension = extensionOf(file.name).toLowerCase();

    const suffix = `.${extension}`;

    const baseName =
      extension &&
      file.name.toLowerCase().endsWith(suffix.toLowerCase())
        ? file.name.slice(0, -suffix.length)
        : file.name;

    const isImage = ["jpg", "jpeg", "png"].includes(extension);

    const request: AttachmentUploadRequest = {
      dataAreaId: companyId,
      AttachmentDescription: description.trim(),
      SalesOrderNumber: salesOrderNumber,
      FileType: extension,
      DocumentAttachmentTypeCode: isImage ? "Imagen" : "Archivo",
      FileName: baseName,
      Attachment: await fileToBase64(file),
    };

    const response = await api.post<
      AttachmentDto | AttachmentDto[]
    >(
      "/d365/sales_header_documents_atachments",
      request,
      {
        timeoutMs: 120_000,
      },
    );

    const attachmentDto = Array.isArray(response)
      ? (response[0] ?? {})
      : response;

    return mapAttachment(attachmentDto);
  },
});

/**
 * Tipos MIME permitidos para visualización.
 */
const mime: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/**
 * Construye un nombre de descarga seguro conservando
 * la extensión informada.
 *
 * Elimina rutas, caracteres de control y caracteres
 * inválidos para nombres de archivo.
 *
 * @param name Nombre original del archivo.
 * @param extension Extensión informada.
 * @returns Nombre de archivo sanitizado.
 */
export const safeDownloadName = (
  name: string,
  extension: string,
): string => {
  // Eliminar rutas Windows y Linux.
  const fileName = name.split(/[\\/]/).pop() ?? "";

  // Eliminar caracteres de control y caracteres inválidos.
  const cleanName = Array.from(fileName)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;

      return (
        code > 31 &&
        code !== 127 &&
        !String.raw`<>:"/\\|?*`.includes(character)
      );
    })
    .join("")
    .trim();

  const safeName = cleanName || "archivo";

  // Normalizar y sanitizar la extensión.
  const safeExtension = extension
    .replace(/^\.+/, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  if (!safeExtension) {
    return safeName;
  }

  const suffix = `.${safeExtension}`;

  // Evitar duplicar la extensión.
  if (safeName.toLowerCase().endsWith(suffix)) {
    return safeName;
  }

  return `${safeName}${suffix}`;
};

/**
 * Abre un adjunto Base64 en una nueva pestaña
 * utilizando su tipo MIME conocido.
 *
 * Para extensiones no reconocidas, fuerza la descarga.
 *
 * @param attachment Adjunto obtenido desde Dynamics 365.
 * @param openWindow Función opcional para abrir una ventana.
 * @returns Nombre sanitizado del archivo.
 */
export const openAttachment = (
  attachment: OrderAttachment,
  openWindow: (url: string) => Window | null = (url) =>
    window.open(url, "_blank", "noopener"),
): string => {
  // Normalizar extensión.
  const extension = attachment.fileType.toLowerCase();

  // Decodificar contenido Base64.
  const binary = atob(attachment.contentBase64);

  const bytes = Uint8Array.from(
    binary,
    (character) => character.codePointAt(0) ?? 0,
  );

  // Determinar tipo MIME.
  const contentType =
    mime[extension] ?? "application/octet-stream";

  // Crear archivo en memoria.
  const blob = new Blob([bytes], {
    type: contentType,
  });

  // Crear URL temporal.
  const url = URL.createObjectURL(blob);

  // Generar nombre de descarga seguro.
  const name = safeDownloadName(
    attachment.fileName,
    extension,
  );

  try {
    if (["pdf", "png", "jpg", "jpeg"].includes(extension)) {
      openWindow(url);
    } else {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
    }
  } finally {
    // También se libera si falla la apertura o el clic de descarga.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return name;
};
