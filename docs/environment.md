# Ambientes y variables

Todas las variables `VITE_*` son públicas: Vite las incorpora al JavaScript. Nunca colocar contraseñas, tokens, API keys o client secrets.

| Variable | Obligatoria | Propósito | Secreto |
|---|---:|---|---:|
| `VITE_API_BASE_URL` | Sí | URL base HTTPS del proxy, normalmente terminada en `/api` | No |
| `VITE_AUTH_MODE` | Sí | `msal` final o `dev-token` temporal | No |
| `VITE_DEV_ACCESS_TOKEN` | Sólo dev-token | Token manual temporal; visible en bundle | **Sí, valor sensible aunque Vite no lo protege** |
| `VITE_AZURE_TENANT_ID` | Sí | Tenant corporativo de Entra ID | No |
| `VITE_AZURE_CLIENT_ID` | Sí | Identificador del public client SPA | No |
| `VITE_AZURE_SCOPE` | Sí | Scope delegado de la API | No |

Para desarrollo, copiar `.env.example` a un archivo local ignorado y usar valores del ambiente de desarrollo. Producción debe inyectar los cuatro valores en el job de build; no reutilizar el artefacto de otro ambiente porque Vite resuelve variables durante build. La pantalla de login bloquea el acceso y enumera variables ausentes.

Los placeholders de `.env.example` no son configuración válida de producción. La URL productiva aún no está definida en el repositorio.

Uso temporal local:

```dotenv
VITE_AUTH_MODE=dev-token
VITE_DEV_ACCESS_TOKEN=
```

Agregar el valor únicamente a `.env` local ignorado. `.env`, `.env.local` y `.env.*.local` están en `.gitignore`. Nunca utilizar este modo en producción ni CI. La protección de Vite rechaza builds con `VITE_AUTH_MODE=dev-token`.
