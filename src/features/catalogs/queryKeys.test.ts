import { describe, expect, it } from 'vitest';
import { catalogKeys } from './queryKeys';
describe('catalog query keys', () => {
  it('segregates server state by company', () =>
    expect(catalogKeys.products('company-a', 'x', 1)).not.toEqual(
      catalogKeys.products('company-b', 'x', 1),
    ));
  it('does not reuse prices across customers or currencies', () => {
    expect(catalogKeys.price('co', 'a', 'GTQ', 'i', null)).not.toEqual(
      catalogKeys.price('co', 'b', 'GTQ', 'i', null),
    );
    expect(catalogKeys.price('co', 'a', 'GTQ', 'i', null)).not.toEqual(
      catalogKeys.price('co', 'a', 'USD', 'i', null),
    );
  });
  it('does not reuse prices across variants', () => {
    const a = { configId: 'a', colorId: '', sizeId: '', styleId: '', versionId: '' };
    const b = { ...a, configId: 'b' };
    expect(catalogKeys.price('co', 'c', 'GTQ', 'i', a)).not.toEqual(
      catalogKeys.price('co', 'c', 'GTQ', 'i', b),
    );
  });
});
