import { beforeEach, describe, expect, it } from 'vitest';
import { clearOperationalContext, emptyOperationalContext, loadOperationalContext, saveOperationalContext } from './storage';
describe('operational context storage', () => {
  beforeEach(() => sessionStorage.clear());
  it('restores context only for the same account', () => { const value = { ...emptyOperationalContext('a'), warning: 'saved' }; saveOperationalContext(value); expect(loadOperationalContext('a').warning).toBe('saved'); expect(loadOperationalContext('b').warning).toBeNull(); });
  it('clears persisted context', () => { saveOperationalContext(emptyOperationalContext('a')); clearOperationalContext(); expect(loadOperationalContext('a').accountId).toBe('a'); expect(sessionStorage.length).toBe(0); });
});

