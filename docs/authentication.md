# Autenticación y Microsoft Entra ID

La Web usa `@azure/msal-browser` como SPA **public client**. No debe existir client secret. El login es popup, la adquisición normal es silenciosa y, sólo si Entra exige interacción, se abre popup. Ante un segundo 401 después de renovar una vez, se cierra la sesión; no existe bucle de renovación.

## Modo temporal de desarrollo

Mientras se completa el registro Entra, `VITE_AUTH_MODE=dev-token` selecciona un proveedor temporal que entrega `VITE_DEV_ACCESS_TOKEN` al `ApiClient`. Es **TEMPORAL · DEVELOPMENT ONLY · NOT FOR PRODUCTION**. El token se incorpora al bundle de desarrollo y no es un secreto protegido.

El modo es explícito: la presencia del token nunca lo activa. Si falta el token o el JWT no contiene `oid`/`sub`, la autenticación falla cerrada sin inventar identidad. El identificador local se deriva del claim sólo para segregar storage. Ante 401 no hay refresh, popup ni retry: se muestra que debe renovarse `.env` y reiniciarse.

`e2e-mock` sólo existe bajo `vite --mode e2e`: usa identidad/autorización sintéticas y fetch mockeado. No lee `.env`, Backend ni Dynamics. Tanto `dev-token` como un build `--mode e2e` son rechazados por `vite.config.ts` al ejecutar un build productivo.

## Registro de aplicación

- Tenant ID: tenant corporativo permitido.
- Client ID: registro específico de la SPA Web.
- Plataforma: Single-page application (SPA), no Web/confidential client.
- Scope delegado: valor exacto de `VITE_AZURE_SCOPE`, expuesto por la API.
- Consentimiento/permisos: el scope delegado requerido por el proxy.
- Development redirect URI: origen usado por Vite, por ejemplo `http://localhost:5173`.
- Development logout URI: `http://localhost:5173/login`.
- Production redirect URI: `https://<WEB_ORIGIN_PRODUCTIVO>`.
- Production logout URI: `https://<WEB_ORIGIN_PRODUCTIVO>/login`.

El código deriva redirect y logout del `window.location.origin`; no hardcodea un dominio productivo. Cada origen debe registrarse exactamente en Entra. `login.microsoftonline.com` debe estar permitido por controles de red/CSP.

MSAL administra su propio token cache en `sessionStorage`. La aplicación nunca lee el token para persistirlo ni lo registra. Logout limpia query cache, draft y contexto; conserva una recuperación transaccional que puede representar un pedido real y luego ejecuta `logoutPopup`.

Para reactivar MSAL, establecer `VITE_AUTH_MODE=msal`, retirar `VITE_DEV_ACCESS_TOKEN` del ambiente local y configurar Tenant/Client/Scope. `ApiClient`, providers funcionales y features no requieren rediseño.
