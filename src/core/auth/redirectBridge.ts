import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

/**
 * Punto de entrada de `/auth/redirect.html`, la Redirect URI SPA registrada en Entra ID.
 *
 * MSAL 5 no lee la URL del popup desde la ventana principal: esta página reenvía la
 * respuesta mediante `BroadcastChannel` a la ventana que ejecutó `loginPopup()` (o al
 * iframe de renovación silenciosa), limpia la URL y cierra el popup. El intercambio del
 * código por tokens ocurre únicamente en la ventana principal.
 */
broadcastResponseToMainFrame().catch((error: unknown) => {
  // Solo se registra el código de error; nunca la URL, el código de autorización ni tokens.
  const code = (error as { errorCode?: string } | null)?.errorCode ?? 'unknown_error';
  console.error(`MSAL redirect bridge: ${code}`);
});
