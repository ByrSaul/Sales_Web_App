import type { Customer } from './types';

/** Determina si la descripción del cliente representa un bloqueo comercial total. */
export const isFullyBlockedCustomer = (customer: Pick<Customer, 'blockedDescription'>) =>
  customer.blockedDescription.trim().toLowerCase() === 'todo';
