import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateRandomToken, hashToken } from '../utils/crypto';

describe('Crypto Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateRandomToken', () => {
    it('should generate a token of specified length', () => {
      const token = generateRandomToken(32);
      expect(token.length).toBe(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateRandomToken(32);
      const token2 = generateRandomToken(32);
      expect(token1).not.toBe(token2);
    });

    it('should only contain alphanumeric characters', () => {
      const token = generateRandomToken(64);
      expect(token).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('hashToken', () => {
    it('should hash a token consistently', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token-1');
      const hash2 = hashToken('token-2');

      expect(hash1).not.toBe(hash2);
    });
  });
});
