import { describe, expect, it } from 'vitest';
import { emptyOperationalContext } from '../../core/session/storage';
import { destinationFor } from './routePolicy';

const company = {
  id: 'cmp',
  name: 'Company',
  defaultCurrency: 'GTQ',
  availableCurrencies: ['GTQ'],
};
const vendor = { companyId: 'cmp', id: 'sales', name: 'Vendor' };
const user = { id: 'user', name: 'User', language: 'es', personnelNumber: '1' };
describe('route policy', () => {
  it('sends unauthenticated users to login', () =>
    expect(destinationFor({ authenticated: false, context: emptyOperationalContext() })).toBe(
      '/login',
    ));
  it('requires a company', () =>
    expect(
      destinationFor({ authenticated: true, context: emptyOperationalContext('account') }),
    ).toBe('/company'));
  it('requires a vendor after company selection', () =>
    expect(
      destinationFor({
        authenticated: true,
        context: { ...emptyOperationalContext('account'), company },
      }),
    ).toBe('/vendor'));
  it('allows home with a complete context', () =>
    expect(
      destinationFor({
        authenticated: true,
        context: { ...emptyOperationalContext('account'), company, vendor, user },
      }),
    ).toBe('/home'));
});
