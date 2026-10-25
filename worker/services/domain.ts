// Strict Domain Boundary Matching & Approval Service

export interface DomainCheckResult {
  isValid: boolean;
  hostname: string;
  isApproved: boolean;
  error?: string;
  errorCode?: string;
  banglaMessage?: string;
}

/**
 * Validates destination URL and checks if hostname matches approved domain boundaries.
 * 
 * Rules:
 * Hostname matches approved domain D if:
 * 1. Hostname equals D (e.g. "nasirdigitalhub.com" matches "nasirdigitalhub.com")
 * 2. Hostname ends with ".D" (e.g. "blog.nasirdigitalhub.com" matches "nasirdigitalhub.com")
 * 
 * Hostnames like "evil-nasirdigitalhub.com" or "nasirdigitalhub.com.attacker.com" MUST BE REJECTED.
 */
export function extractAndValidateHostname(rawUrl: string): { hostname: string; sanitizedUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('INVALID_URL: Please provide a valid HTTP or HTTPS URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('INVALID_PROTOCOL: URL protocol must be http:// or https://');
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname || hostname.includes(' ') || hostname.length < 3) {
    throw new Error('INVALID_HOSTNAME: Malformed hostname');
  }

  // Prevent internal network SSRF
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.')
  ) {
    throw new Error('FORBIDDEN_HOSTNAME: Local and private hostnames are not allowed');
  }

  return { hostname, sanitizedUrl: parsed.toString() };
}

export function isDomainApproved(hostname: string, approvedDomains: string[]): boolean {
  const host = hostname.toLowerCase();
  for (const approved of approvedDomains) {
    const app = approved.toLowerCase().trim();
    if (host === app || host.endsWith('.' + app)) {
      return true;
    }
  }
  return false;
}
