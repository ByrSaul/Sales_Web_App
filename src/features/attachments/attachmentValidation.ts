const allowed = new Set(['pdf', 'jpg', 'jpeg', 'png']);
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
/** Obtiene la extensión normalizada de un nombre de archivo. */
export const extensionOf = (name: string) =>
  name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
/** Valida descripción, extensión y tamaño de un adjunto seleccionado. */
export const validateAttachment = (file: File, description: string): string | null => {
  if (!allowed.has(extensionOf(file.name)))
    return 'Solo se permiten archivos PDF, JPG, JPEG o PNG.';
  if (file.size > MAX_ATTACHMENT_BYTES) return 'El archivo supera el máximo de 5 MB.';
  const trimmed = description.trim();
  if (!trimmed) return 'La descripción es obligatoria.';
  if (trimmed.length > 100) return 'La descripción no puede exceder 100 caracteres.';
  return null;
};
export const isPaymentDescription = (description: string) =>
  description.trim().toLowerCase() === 'pago';
/** Indica si la cuenta exige adjuntar un comprobante de pago. */
export const requiresPaymentAttachment = (customerAccount: string | null | undefined) =>
  customerAccount?.trim().toUpperCase() === 'MOST-000001';
const imageExtensions = new Set(['jpg', 'jpeg', 'png']);
export const isPaymentImage = (description: string, fileType: string) =>
  isPaymentDescription(description) && imageExtensions.has(fileType.trim().toLowerCase().replace(/^\./, ''));
/** Verifica la existencia de un comprobante de pago válido entre adjuntos generales. */
export const hasValidPaymentAttachment = (
  attachments: readonly { description: string; fileType: string }[],
) => attachments.some((item) => isPaymentImage(item.description, item.fileType));
/** Verifica la regla de comprobante sobre los adjuntos locales del borrador. */
export const hasValidLocalPaymentAttachment = (
  attachments: readonly { description: string; extension: string }[],
) => attachments.some((item) => isPaymentImage(item.description, item.extension));
