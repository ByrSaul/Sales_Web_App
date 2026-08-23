const allowed = new Set(['pdf', 'jpg', 'jpeg', 'png']);
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const extensionOf = (name: string) =>
  name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
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
