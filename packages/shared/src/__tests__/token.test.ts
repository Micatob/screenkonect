import { describe, it, expect } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/token';

describe('Token Utilities', () => {
  const testPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    role: 'technician' as const,
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(testPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(testPayload);
      const payload = verifyAccessToken(token);

      expect(payload.sub).toBe(testPayload.sub);
      expect(payload.email).toBe(testPayload.email);
      expect(payload.role).toBe(testPayload.role);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testPayload);
      const payload = verifyRefreshToken(token);

      expect(payload.sub).toBe(testPayload.sub);
      expect(payload.email).toBe(testPayload.email);
      expect(payload.role).toBe(testPayload.role);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });
  });
});
