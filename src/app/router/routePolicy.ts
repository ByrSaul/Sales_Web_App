import type { OperationalContext } from '../../core/session/types';
/** Estado mínimo de sesión requerido para decidir la ruta de destino. */
export type RouteSession = { authenticated: boolean; context: OperationalContext };
/** Resuelve la primera ruta válida según autenticación y contexto operativo. */
export const destinationFor = ({
  authenticated,
  context,
}: RouteSession): '/login' | '/company' | '/vendor' | '/home' => {
  if (!authenticated) return '/login';
  if (!context.company) return '/company';
  if (!context.vendor || !context.user) return '/vendor';
  return '/home';
};
