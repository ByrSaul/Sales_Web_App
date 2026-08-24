import { describe, expect, it } from 'vitest';
import { isFullyBlockedCustomer } from './customerRules';

describe('isFullyBlockedCustomer', () => {
  it('normalizes blocked_description using trim and lowercase', () => {
    expect(isFullyBlockedCustomer({ blockedDescription: '  ToDo ' })).toBe(true);
    expect(isFullyBlockedCustomer({ blockedDescription: 'No' })).toBe(false);
  });
});
