import { describe, expect, it } from 'vitest';
import { createDevTokenProvider, devAccountId, DevTokenConfigurationError } from './devToken';

const syntheticJwt = (claims: Record<string, string>) => `x.${btoa(JSON.stringify(claims)).replace(/=/g, '')}.x`;

describe('temporary development token provider', () => {
  it('returns the configured token and derives account segregation from oid', async () => {
    const token = syntheticJwt({ oid: 'controlled-test-identity' });
    await expect(createDevTokenProvider(token)()).resolves.toBe(token);
    expect(devAccountId(token)).toBe('dev-token:controlled-test-identity');
  });
  it('fails closed without a token and never includes token material in errors', () => {
    expect(() => devAccountId('')).toThrow('no está configurado');
    const material = syntheticJwt({ role: 'missing-identity' });
    try { devAccountId(material); } catch (cause) { expect(String(cause)).not.toContain(material); }
  });
  it('tags a missing token as configuration and a missing oid/sub as identity', () => {
    try { devAccountId(''); expect.unreachable(); } catch (cause) { expect((cause as DevTokenConfigurationError).kind).toBe('configuration'); }
    const material = syntheticJwt({ role: 'missing-identity' });
    try { devAccountId(material); expect.unreachable(); } catch (cause) { expect((cause as DevTokenConfigurationError).kind).toBe('identity'); }
  });
});
