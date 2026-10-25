import { describe, it, expect } from 'vitest';
import { extractAndValidateHostname, isDomainApproved } from '../worker/services/domain';

describe('Domain Validation & Boundary Matching', () => {
  const approvedList = ['nasirdigitalhub.com', 'google.com', 'facebook.com', 'youtube.com'];

  it('correctly approves exact matching domain', () => {
    expect(isDomainApproved('nasirdigitalhub.com', approvedList)).toBe(true);
    expect(isDomainApproved('google.com', approvedList)).toBe(true);
  });

  it('correctly approves subdomain of approved domain', () => {
    expect(isDomainApproved('app.nasirdigitalhub.com', approvedList)).toBe(true);
    expect(isDomainApproved('auth.sub.google.com', approvedList)).toBe(true);
  });

  it('strictly rejects malicious lookalike domains (boundary protection)', () => {
    // Should NOT match because of boundary
    expect(isDomainApproved('evil-nasirdigitalhub.com', approvedList)).toBe(false);
    expect(isDomainApproved('nasirdigitalhub.com.attacker.com', approvedList)).toBe(false);
    expect(isDomainApproved('notgoogle.com', approvedList)).toBe(false);
    expect(isDomainApproved('google.com.phishing.site', approvedList)).toBe(false);
  });

  it('sanitizes and extracts hostname accurately', () => {
    const res = extractAndValidateHostname('https://nasirdigitalhub.com/path?foo=bar#hash');
    expect(res.hostname).toBe('nasirdigitalhub.com');
  });

  it('rejects invalid or dangerous SSRF local targets', () => {
    expect(() => extractAndValidateHostname('http://localhost:8080/admin')).toThrow();
    expect(() => extractAndValidateHostname('http://127.0.0.1/secrets')).toThrow();
    expect(() => extractAndValidateHostname('http://192.168.1.1/router')).toThrow();
    expect(() => extractAndValidateHostname('not-a-valid-url')).toThrow();
  });
});
