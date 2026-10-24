// apps/api/test/api.test.ts
// Unit tests for API schemas, passcode verification, and session tokens.

import { describe, it, expect } from 'vitest';
import { verifyPasscode } from '../src/auth.js';
import {
  joinSchema,
  cancelSchema,
  loginSchema,
  addCounterSchema,
} from '../src/schemas.js';

describe('API authentication and schemas', () => {
  describe('verifyPasscode', () => {
    it('accepts correct passcode', () => {
      expect(verifyPasscode('demo')).toBe(true);
    });

    it('rejects incorrect passcode', () => {
      expect(verifyPasscode('wrong')).toBe(false);
      expect(verifyPasscode('')).toBe(false);
    });
  });

  describe('Validation schemas', () => {
    it('validates join request correctly', () => {
      const valid = joinSchema.safeParse({
        name: 'Alice Smith',
        serviceId: 'srv-1',
      });
      expect(valid.success).toBe(true);

      const invalidName = joinSchema.safeParse({
        name: '',
        serviceId: 'srv-1',
      });
      expect(invalidName.success).toBe(false);
    });

    it('validates cancel request correctly', () => {
      const valid = cancelSchema.safeParse({ cancelSecret: 'secret-123' });
      expect(valid.success).toBe(true);

      const invalid = cancelSchema.safeParse({});
      expect(invalid.success).toBe(false);
    });

    it('validates admin login schema', () => {
      expect(loginSchema.safeParse({ passcode: 'demo' }).success).toBe(true);
      expect(loginSchema.safeParse({ passcode: '' }).success).toBe(false);
    });

    it('validates add counter schema', () => {
      expect(
        addCounterSchema.safeParse({
          name: 'Counter 3',
          serviceIds: ['srv-1'],
        }).success
      ).toBe(true);

      expect(
        addCounterSchema.safeParse({
          name: 'Counter 3',
          serviceIds: [],
        }).success
      ).toBe(false);
    });
  });
});
