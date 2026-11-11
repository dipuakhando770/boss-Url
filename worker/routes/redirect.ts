import { Database } from '../db';
import { generateRandomString, hashIp } from '../services/crypto';
import { ClickRecord } from '../types';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });
}

function renderHtml(title: string, body: string, status = 200): Response {
  // Use string arrays instead of template literals to avoid unterminated
  // template-literal parsing errors in copied/edited source files.
  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex,nofollow">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<title>' + escapeHtml(title) + ' | Boss URL Shortener</title>',
    '<style>',
    '* { box-sizing: border-box; }',
    ':root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }',
    'body { min-height: 100vh; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; }',
    '.card { width: 100%; max-width: 620px; padding: 40px; background: #1e293b; border: 1px solid #334155; border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,.28); }',
    '.status-icon { width: 54px; height: 54px; display: grid; place-items: center; margin-bottom: 22px; border-radius: 16px; background: rgba(34,197,94,.13); color: #4ade80; font-size: 28px; font-weight: 800; }',
    'h1 { margin: 0 0 12px; font-size: clamp(26px,5vw,34px); line-height: 1.2; }',
    'p { margin: 0 0 24px; color: #cbd5e1; font-size: 16px; line-height: 1.7; }',
    '.actions { display: grid; gap: 12px; }',
    '.button { display: flex; min-height: 50px; align-items: center; justify-content: center; padding: 14px 20px; border: 0; border-radius: 9px; background: #16a34a; color: #fff; font-size: 16px; font-weight: 700; text-align: center; text-decoration: none; cursor: pointer; transition: background .2s ease, transform .2s ease; }',
    '.button:hover { background: #15803d; transform: translateY(-1px); }',
    '.button-secondary { background: #334155; color: #e2e8f0; }',
    '.button-secondary:hover { background: #475569; }',
    '.note { margin: 20px 0 0; color: #94a3b8; font-size: 13px; text-align: center; }',
    '@media (max-width: 480px) { body { padding: 16px; } .card { padding: 28px 22px; } }',
    '</style>',
    '</head>',
    '<body>',
    '<main class="card">',
    body,
    '</main>',
    '</body>',
    '</html>',
  ].join('\n');

  return new Response(html, {
    status: status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    },
  });
}

function renderError(heading: string, message: string, status: number): Response {
  const body =
    '<div class="status-icon" aria-hidden="true">!</div>' +
    '<h1>' + escapeHtml(heading) + '</h1>' +
    '<p>' + escapeHtml(message) + '</p>' +
    '<a class="button button-secondary" href="/">Go to Homepage</a>';

  return renderHtml(heading, body, status);
}

/**
 * Creates the vnd.youtube custom-scheme URL.
 * The destination comes from the database and is encoded once as q.
 *
 * The supplied redir_token may expire or be rejected by YouTube.
 */
function createYouTubeRedirectUrl(destination: URL): string {
  const params = new URLSearchParams();

  params.set('event', 'comments');
  params.set(
    'redir_token',
    'QUlxb01IWV9meHRYVXo0akE0T1M5QzVNaS1XWXxBQnJ0NjltbHFBRmFqbXZXRDcxVEZsSmhILThkQWJWYlBmX25seWI1NXRzZEw5MVNxUkM3TUREeGcyZWdDakRIYTZuUkZKOXdJSjFBU1JJZ2pILW5vSGlIVmIycUc0OWthcmNJ'
  );
  params.set('q', destination.toString());
  params.set('html_redirect', '1');

  return 'vnd.youtube://youtube.com/redirect?' + params.toString();
