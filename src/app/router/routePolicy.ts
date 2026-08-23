import type { OperationalContext } from '../../core/session/types';
export type RouteSession = { authenticated: boolean; context: OperationalContext };
export const destinationFor = ({ authenticated, context }: RouteSession): '/login' | '/company' | '/vendor' | '/home' => {
  if (!authenticated) return '/login';
  if (!context.company) return '/company';
  if (!context.vendor || !context.user) return '/vendor';
  return '/home';
};
