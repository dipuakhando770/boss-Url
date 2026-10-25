import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateRandomString, generateShortCode, hashIp } from '../worker/services/crypto';

describe('WebCrypto PBKDF2 & Code Generation Service', () => {
  it('hashes password and verifies successfully', async () => {
    const rawPass = 'SecretPassword123!';
    const { hash, salt } = await hashPassword(rawPass);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex string length
    expect(salt).toBeDefined();

    const isMatch = await verifyPassword(rawPass, hash, salt);
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword('WrongPassword', hash, salt);
    expect(isWrongMatch).toBe(false);
  });

  it('generates random hex strings of requested length', () => {
    const token = generateRandomString(32);
    expect(token.length).toBe(64); // 32 bytes in hex = 64 chars
  });

  it('generates alphanumeric short codes of requested length', () => {
    const code = generateShortCode(6);
    expect(code.length).toBe(6);
    expect(/^[a-zA-Z0-9]+$/.test(code)).toBe(true);
  });

  it('hashes IP addresses for privacy-first analytics', async () => {
    const ipHash = await hashIp('103.205.180.25');
    expect(ipHash.length).toBe(16);
  });
});
