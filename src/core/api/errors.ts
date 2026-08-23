export type ApiErrorKind =
  | 'authentication'
  | 'forbidden'
  | 'timeout'
  | 'network'
  | 'backend'
  | 'invalid-response'
  | 'unknown'
  | 'configuration'
  | 'identity';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const userErrorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado. Intenta nuevamente.';
  switch (error.kind) {
    case 'authentication':
      return error.message || 'Tu sesión expiró. Inicia sesión nuevamente.';
    case 'forbidden':
      return 'No tienes permiso para realizar esta operación.';
    case 'timeout':
      return 'El servicio tardó demasiado en responder.';
    case 'network':
      return 'No fue posible conectar con el servicio.';
    case 'invalid-response':
      return 'El servicio devolvió una respuesta no válida.';
    case 'configuration':
      return (
        error.message ||
        'Configuración de autenticación incompleta. Verifica VITE_AUTH_MODE y VITE_DEV_ACCESS_TOKEN.'
      );
    case 'identity':
      return error.message || 'El token de desarrollo no contiene una identidad válida (oid/sub).';
    default:
      return 'No fue posible completar la operación.';
  }
};
