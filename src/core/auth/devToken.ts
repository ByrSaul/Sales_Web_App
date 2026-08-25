export type DevTokenErrorKind = 'configuration' | 'identity';

/** Error tipado para tokens de desarrollo ausentes o incompatibles. */
export class DevTokenConfigurationError extends Error {
  constructor(
    message: string,
    public readonly kind: DevTokenErrorKind = 'configuration',
  ) {
    super(message);
    this.name = 'DevTokenConfigurationError';
  }
}

const decodePayload = (token: string): Record<string, unknown> => {
  const payload = token.split('.')[1];
  if (!payload)
    throw new DevTokenConfigurationError('El token de desarrollo no tiene un payload JWT válido.');
  try {
    const normalized = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    throw new DevTokenConfigurationError('El token de desarrollo no tiene un payload JWT válido.');
  }
};

/** Extrae la identidad estable de cuenta desde el payload de un token de desarrollo. */
export const devAccountId = (token: string): string => {
  if (!token) throw new DevTokenConfigurationError('El token de desarrollo no está configurado.');
  const claims = decodePayload(token);
  const id = claims.oid ?? claims.sub;
  if (typeof id !== 'string' || !id.trim())
    throw new DevTokenConfigurationError(
      'El token de desarrollo no contiene un identificador oid/sub utilizable.',
      'identity',
    );
  return `dev-token:${id.trim()}`;
};

/** Crea un proveedor de token fijo que valida configuración e identidad antes de usarlo. */
export const createDevTokenProvider = (token: string) => async (): Promise<string> => {
  if (!token) throw new DevTokenConfigurationError('El token de desarrollo no está configurado.');
  return token;
};
