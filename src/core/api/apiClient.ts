import { ApiError } from './errors';

type TokenProvider = (forceRefresh: boolean) => Promise<string>;
type UnauthorizedHandler = () => Promise<void> | void;

/** Configuración de autenticación, transporte y tiempos límite del cliente HTTP. */
export type ApiClientOptions = {
  baseUrl: string;
  getToken: TokenProvider;
  onUnauthorized: UnauthorizedHandler;
  refreshOnUnauthorized?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Cliente HTTP autenticado utilizado por los servicios de la aplicación.
 *
 * Responsabilidades:
 * - Resolver y adjuntar el token de acceso.
 * - Serializar cuerpos JSON y deserializar respuestas.
 * - Aplicar tiempos límite y cancelación mediante `AbortSignal`.
 * - Clasificar errores HTTP, de red y de autenticación.
 * - Reintentar una vez después de renovar un token no autorizado.
 */
export class ApiClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private refreshPromise: Promise<string> | null = null;

  /** Inicializa el cliente con sus proveedores de autenticación y transporte. */
  constructor(private readonly options: ApiClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 20_000;
    // fetch is a native method that requires `window` as its receiver; storing the bare
    // reference and calling it as `this.fetchImpl(...)` throws "Illegal invocation" before
    // any network activity, which the catch below then misreports as a network error.
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /** Ejecuta una solicitud GET y devuelve su respuesta JSON tipada. */
  get<T>(
    path: string,
    options?: { body?: unknown; signal?: AbortSignal; timeoutMs?: number },
  ): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
    });
  }
  /** Ejecuta una solicitud POST serializando opcionalmente un cuerpo JSON. */
  post<T>(
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal; timeoutMs?: number; retryOnUnauthorized?: boolean },
  ): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
      retryOnUnauthorized: options?.retryOnUnauthorized,
    });
  }
  /** Ejecuta una actualización parcial mediante PATCH. */
  patch<T>(path: string, body?: unknown, options?: { timeoutMs?: number }): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
      timeoutMs: options?.timeoutMs,
    });
  }
  /** Ejecuta una eliminación y admite los contratos que requieren cuerpo JSON. */
  delete<T>(
    path: string,
    body?: unknown,
    options?: { timeoutMs?: number; retryOnUnauthorized?: boolean },
  ): Promise<T> {
    return this.request<T>(path, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
      timeoutMs: options?.timeoutMs,
      retryOnUnauthorized: options?.retryOnUnauthorized,
    });
  }

  /**
   * Ejecuta el flujo común de autenticación, cancelación, reintento y manejo de errores.
   *
   * @param path Ruta relativa al API configurado.
   * @param init Opciones nativas de la solicitud y extensiones del cliente.
   * @param retried Indica si ya se consumió el reintento por autenticación.
   * @returns Respuesta JSON convertida al tipo solicitado.
   */
  private async request<T>(
    path: string,
    init: RequestInit & { timeoutMs?: number; retryOnUnauthorized?: boolean } = {},
    retried = false,
  ): Promise<T> {
    // Token acquisition is classified on its own: a failure here means fetch() never runs,
    // so it must never surface as a 'network' error. Providers that already know the precise
    // cause (e.g. dev-token config/identity failures) throw a typed ApiError; anything else
    // falls back to 'configuration' rather than being miscategorized as connectivity.
    let token: string;
    try {
      token = await this.options.getToken(false);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'configuration',
        error instanceof Error
          ? error.message
          : 'No fue posible obtener el token de autenticación.',
      );
    }
    const controller = new AbortController();
    const externalSignal = init.signal;
    const { timeoutMs, retryOnUnauthorized, ...fetchInit } = init;
    const abortFromExternal = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
        ...fetchInit,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...fetchInit.headers,
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        if (retryOnUnauthorized === false)
          throw new ApiError(
            'authentication',
            'La sesi\u00f3n fue rechazada; la operaci\u00f3n no se repiti\u00f3 autom\u00e1ticamente.',
            401,
          );
        if (this.options.refreshOnUnauthorized === false) {
          await this.options.onUnauthorized();
          throw new ApiError(
            'authentication',
            'El token de desarrollo fue rechazado o puede haber expirado.',
            401,
          );
        }
        if (retried) {
          await this.options.onUnauthorized();
          throw new ApiError(
            'authentication',
            'No fue posible renovar la sesión. Inicia sesión nuevamente.',
            401,
          );
        }
        await this.refreshToken();
        return this.request<T>(path, init, true);
      }
      if (response.status === 403) throw new ApiError('forbidden', 'Forbidden', 403);
      if (!response.ok)
        throw new ApiError(
          'backend',
          'Backend request failed',
          response.status,
          await this.safeBody(response),
        );
      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch (error) {
        throw new ApiError('invalid-response', 'Invalid JSON response', response.status, error);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError')
        throw new ApiError('timeout', 'Request timeout');
      if (error instanceof TypeError) throw new ApiError('network', 'Network error');
      throw new ApiError('unknown', 'Unknown API error', undefined, error);
    } finally {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    }
  }

  private refreshToken(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.options.getToken(true).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async safeBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}
