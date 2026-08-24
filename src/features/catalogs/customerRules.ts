import type { Customer } from './types';

export const isFullyBlockedCustomer = (customer: Pick<Customer, 'blockedDescription'>) =>
  customer.blockedDescription.trim().toLowerCase() === 'todo';
