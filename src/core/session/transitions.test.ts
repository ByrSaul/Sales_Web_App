import { describe, expect, it } from 'vitest';
import { withSelectedCompany, withoutCompany } from './transitions';
const company = {
  id: 'cmp',
  name: 'Company',
  defaultCurrency: 'GTQ',
  availableCurrencies: ['GTQ'],
};
describe('operational context transitions', () => {
  it('selects a company with an empty dependent context', () =>
    expect(withSelectedCompany('account', company)).toMatchObject({
      company,
      vendor: null,
      user: null,
      permissions: [],
    }));
  it('changing company clears vendor, user and permissions', () => {
    const context = withoutCompany('account');
    expect(context).toMatchObject({ company: null, vendor: null, user: null, permissions: [] });
  });
});
