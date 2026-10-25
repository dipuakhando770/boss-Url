# Boss URL Shortener SaaS

[![CI Checks](https://github.com/dipuakhando770/boss-Url/actions/workflows/ci.yml/badge.svg)](https://github.com/dipuakhando770/boss-Url/actions)
![Node Version](https://img.shields.io/badge/Node.js-v20%2B-blue)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers%20%26%20D1-orange)
![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb)

A modern, high-performance, multi-user **Two-Stage URL Shortener SaaS** built on Cloudflare Workers edge network, Cloudflare D1 distributed SQL, and an external high-speed VPS cluster.

---

## 1. System Architecture & Two-Stage Pipeline

```
  +-------------------------------------------------------------+
  |                   User Submits Destination URL              |
  |         (e.g., https://nasirdigitalhub.com/landing)         |
  +-------------------------------------------------------------+
                                |
                                v
  +-------------------------------------------------------------+
  |              Stage 1: Boss URL Shortener Engine             |
  |   - Authenticates session and validates subscription quota  |
  |   - Verifies destination domain against Approved Allowlist   |
  |   - Generates unique Stage 1 short code (e.g. ABC123)       |
  |   - Persists Stage 1 record in Cloudflare D1 SQL database   |
  |   - Constructs public Stage 1 URL:                          |
  |       https://urlshort.nasirdigitalhub.com/ABC123           |
  +-------------------------------------------------------------+
                                |
                                v
  +-------------------------------------------------------------+
  |              Stage 2: Existing VPS API Engine               |
  |   - Dispatches POST http://107.174.37.180/api/links/stage1  |
  |       Payload: {"url": "https://urlshort.../ABC123"}        |
  |   - Receives verified VPS response:                         |
  |       {"error":false, "stage1_url":"http://107.../s1_XYZ"}  |
  |   - Persists final Stage 2 URL in D1 and marks completed    |
  +-------------------------------------------------------------+
                                |
                                v
  +-------------------------------------------------------------+
  |                Final Short URL Given to User                |
  |                 http://107.174.37.180/s1_XYZ                |
  +-------------------------------------------------------------+

  [When a visitor clicks the short link]:
  http://107.174.37.180/s1_XYZ
         | (302 Found)
         v
  https://urlshort.nasirdigitalhub.com/ABC123
         | (Records Click Analytics: Country, Device, Referrer)
         | (302 Found)
         v
  https://nasirdigitalhub.com/landing (Original Destination)
```

---

## 2. Key Features

- **Two-Stage Shortening Pipeline**: End-to-end coordinated link generation between Cloudflare Edge and the Stage 2 VPS endpoint.
- **Strict Domain Boundary Allowlist**: Protects against phishing and unauthorized destination links. If a domain is not approved, returns:
  > *“এই ডোমেইনটি এখনো অনুমোদিত নয়। অনুমোদনের জন্য অ্যাডমিনের সঙ্গে যোগাযোগ করুন।”*
- **Server-Managed Session Auth**: PBKDF2 WebCrypto password hashing and secure bearer/cookie sessions without external identity vendor locks.
- **Quota & Subscription System**: Configurable plans (Starter Free, Pro Monthly, VIP Annual) with automatic enforcement on every shortening request.
- **Executive Admin Dashboard (`/nachid/admin`)**:
  - Global system metrics & traffic volume
  - User management (search, suspend, reactivate, assign packages)
  - All links inspector & instant deletion
  - Subscription packages editor (duration, quota, pricing)
  - Approved domains manager (live add/remove)
  - Security audit logging for administrative actions
- **Bilingual Interface**: Full English and Bangla language toggle (`বাংলা` / `EN`).
- **Dark & Light Mode**: Tailored HSL color palette with glassmorphism.
- **Privacy-Preserving Click Analytics**: IP hashing, device detection, country analytics, and traffic referrers.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (Distributed SQLite with versioned SQL migrations)
- **Asset Serving**: Cloudflare Workers Assets
- **Testing**: Vitest with unit and integration test coverage
- **CI/CD**: GitHub Actions workflow

---

## 4. Directory Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated CI test and build checks
├── migrations/
│   ├── 0001_init.sql            # Core database schema (users, links, clicks, etc.)
│   └── 0002_seed.sql            # Initial packages, settings, and approved domains
├── src/
│   ├── components/              # Navbar, Footer, Modals (DomainChecker, Analytics)
│   ├── context/                 # AuthContext and ThemeContext
│   ├── lib/                     # API client and Translations (EN/BN)
│   ├── pages/                   # Landing, Login, Register, Dashboard, Admin
│   ├── types/                   # Frontend TypeScript interfaces
│   ├── App.tsx                  # Client router and layout shell
│   ├── index.css                # Tailwind directives and custom tokens
│   └── main.tsx                 # React DOM mount point
├── worker/
│   ├── db/                      # Typed Cloudflare D1 queries
│   ├── routes/                  # Auth, Links, Admin, and Redirect routes
│   ├── services/                # Two-stage shortener, domain guard, crypto
│   ├── index.ts                 # Cloudflare Worker entry point
│   └── types.ts                 # Worker Environment & Data model types
├── tests/                       # Vitest automated test suite
├── wrangler.toml                # Cloudflare Worker & D1 binding configuration
├── vite.config.ts               # Vite configuration with API proxy
└── package.json                 # Project dependencies & scripts
```

---

## 5. Local Setup & Development

### Prerequisites
- Node.js v20+ and npm v10+
- Cloudflare Wrangler CLI (installed via devDependencies)

### Installation
```bash
# Clone the repository
git clone git@github.com:dipuakhando770/boss-Url.git
cd boss-Url

# Install dependencies
npm install
```

### Local Database Migrations
```bash
# Apply migrations to local D1 SQLite database
npm run d1:migrate:local
```

### Run Locally
```bash
# Start frontend dev server
npm run dev

# Start Cloudflare Worker dev server with local D1
npm run dev:worker
```

The frontend will run at `http://localhost:3000` and proxy API calls to the local Worker at `http://localhost:8787`.

---

## 6. Testing

Run the full automated test suite:
```bash
# Run tests
npm test

# Run TypeScript typechecks
npm run typecheck

# Build frontend production bundle
npm run build
```

---

## 7. Cloudflare Deployment Guide

### Step 1: Create Remote Cloudflare D1 Database
```bash
npx wrangler d1 create boss-url-db
```
Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.

### Step 2: Apply Migrations to Remote D1
```bash
npx wrangler d1 migrations apply boss-url-db --remote
```

### Step 3: Configure Cloudflare Secrets
Set your production cryptographic keys using Wrangler secret prompts (never commit secrets to git):
```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put BOOTSTRAP_SECRET
```

### Step 4: Deploy to Cloudflare Workers
```bash
npm run build
npm run deploy
```

---

## 8. Bootstrapping the First Administrator

For security, the initial administrator account is never hardcoded. Once deployed, bootstrap the first administrator using your configured `BOOTSTRAP_SECRET`:

```bash
curl -X POST https://boss-url.steep-satellite.workers.dev/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "bootstrap_secret": "YOUR_CONFIGURED_BOOTSTRAP_SECRET",
    "email": "admin@nasirdigitalhub.com",
    "password": "YourStrongAdminPassword!",
    "name": "Boss Administrator"
  }'
```

Once bootstrapped, navigate to:
`https://urlshort.nasirdigitalhub.com/nachid/admin`
and log in.

---

## 9. VPS Stage 2 Integration & Security Notes

- **Endpoint**: `POST http://107.174.37.180/api/links/stage1`
- **Request Format**: `{"url": "https://urlshort.nasirdigitalhub.com/<CODE>"}`
- **Security Recommendation**: The current VPS endpoint communicates over HTTP. For hardened production environments, it is strongly advised to bind an SSL certificate (e.g. Let's Encrypt) to the VPS host or configure a Cloudflare Tunnel (`cloudflared`) to terminate HTTPS.
- **Failover**: If the VPS endpoint returns non-200 or times out, the link is saved in D1 with status `failed`, returning HTTP 502 without generating fake short URLs.

---

## 10. License

Proprietary SaaS — Boss URL Shortener. All rights reserved.
