import { Database } from '../db';
import { generateRandomString, hashIp } from '../services/crypto';
import { ClickRecord } from '../types';

/**
 * Escape untrusted text before inserting it into HTML.
 */
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

/**
 * Build a consistent HTML response that works in the Cloudflare Workers
 * Fetch API runtime. No Node.js APIs or external runtime packages are used.
 */
function renderHtml(
  title: string,
  body: string,
  status = 200
): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${escapeHtml(title)} | Boss URL Shortener</title>
  <style>
    * { box-sizing: border-box; }

    :root {
      color-scheme: dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Helvetica, Arial, sans-serif;
    }

    body {
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      color: #f8fafc;
    }

    .card {
      width: 100%;
      max-width: 620px;
      padding: 40px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 18px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, .28);
    }

    .status-icon {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      margin-bottom: 22px;
      border-radius: 16px;
      background: rgba(34, 197, 94, .13);
      color: #4ade80;
      font-size: 28px;
      font-weight: 800;
    }

    h1 {
      margin: 0 0 12px;
      font-size: clamp(26px, 5vw, 34px);
      line-height: 1.2;
    }

    p {
      margin: 0 0 24px;
      color: #cbd5e1;
      font-size: 16px;
      line-height: 1.7;
    }

    .actions {
      display: grid;
