# Nabat Al Atlas — Multi-Purpose Moroccan E-Commerce Platform

A production-ready, general-purpose e-commerce platform built with Next.js 15, TypeScript, Tailwind CSS v4, PostgreSQL 17, Drizzle ORM, and Redis/BullMQ. Designed for the Moroccan market (COD, regional delivery pricing, Arabic RTL default + French & English, MAD currency) while featuring a **Hybrid Multi-Tenant Database Architecture** (`SHARED` PostgreSQL with Row-Level Security + `DEDICATED` database routing + automated zero-loss tenant migration engine).

---

## Key Capabilities

### Storefront (`/` · `/shop` · `/products/[slug]` · `/lp/[slug]` · `/checkout`)
- **Multi-Product Catalog:** Supports Physical products, Variable products (sizes/colors/materials with per-variant SKUs, images, pricing, and stock), Digital downloadable files (strictly gated until payment confirmation / `PAID` with tokenized time/limit protection), Bundles (atomic component stock deduction), Services, and Subscriptions.
- **Moroccan Conversion UX:** Unified Quick Order Form (single-page COD conversion) alongside a persistent Shopping Cart Drawer (`BOTH` / `CART_ONLY` / `FORM_ONLY` configurable per store).
- **Multilingual & RTL-First:** Arabic (`ar`, RTL default), French (`fr`, LTR), and English (`en`, LTR) with live language switcher and database-backed translation overrides.
- **Dynamic Theme Engine:** **Botanical Modern Luxury** defaults (`#FAF9F6` / `#14532D` / `#D97706`) with CSS variables driven by database theme records and sanitized custom CSS/HTML support.
- **Marketing & Tracking:** Landing Page Builder (`/lp/[slug]`), countdown promo timers, coupon engine, approved reviews, order tracking (`/track-order`), customer portal (`/account`), dynamic `/sitemap.xml` and `/robots.txt`, plus client/server tracking (Meta Pixel + Conversions API, TikTok Pixel, GA4, GTM, Snap Pixel).

### Admin Dashboard (`/admin`)
- **Role-Based Access Control (RBAC):** `OWNER`, `ADMIN`, `MANAGER`, `CONFIRMATOR`, `EDITOR` with granular per-staff permissions and audit logging.
- **Real-Time Notifications:** PostgreSQL persisted + Redis Pub/Sub / SSE (`/api/admin/notifications/stream`) alerts for new orders, payments, customers, low stock, and pending reviews.
- **Order Operations & Moroccan Fulfillment:** Status pipeline (`NEW`, `PENDING_WHATSAPP_CONFIRMATION`, `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `RETURNED`), bulk updates, CSV & formatted Excel (`.xlsx`) exports, printable A4 Invoices and Shipping Labels.
- **Payments & WhatsApp:**
  - **Cash on Delivery (COD):** Active out-of-the-box with per-city delivery/COD fees and confirmation workflow.
  - **Stripe & PayPal:** Sandbox/Live modes with configurable `MAD -> EUR / USD` currency conversion recorded alongside base MAD amounts and verified webhook endpoints.
  - **CMI (Moroccan Bank Cards):** Modular SHA-512 HMAC-ready gateway adapter ready to activate once merchant credentials (`merchantId`, `storeKey`, `gatewayUrl`) are configured.
  - **Dual WhatsApp Integration:** Built-in Click-to-Chat (`wa.me`) prefilled confirmation links + optional Meta WhatsApp Cloud API automated templates.
- **Visual Editors:** Drag-and-drop (`@dnd-kit`) Homepage Section ordering and Landing Page Builder with desktop/mobile preview.

---

## Hybrid Multi-Tenant Architecture

```
HTTP Host / Auth Context
         │
         ▼
  Control Plane (control_plane.*)
  ├── tenants (isolation_mode: SHARED | DEDICATED)
  ├── tenant_domains
  ├── tenant_migrations_log
  └── platform_audit_logs
         │
         ├── SHARED ────► Shared PostgreSQL Pool (NOBYPASSRLS `app_runtime` role)
         │                 └─ TX: set_config('app.current_tenant_id', tenantId, true)
         │                 └─ 40 Data Plane tables protected by FORCE ROW LEVEL SECURITY
         │
         └── DEDICATED ─► TenantPoolManager (LRU cached pool using AES-256-GCM DB URL)
```

---

## Project Structure

```text
src/
├── app/
│   ├── api/               # Storefront, Customer, Admin, Upload, Media, Health & Webhook routes
│   ├── admin/             # RBAC-protected Admin Dashboard modules
│   ├── lp/[slug]/         # Dynamic Landing Page Renderer
│   ├── products/[slug]/   # Product detail, variants, bundles, quick order & reviews
│   ├── shop/              # Filterable, sortable catalog
│   ├── checkout/          # Full cart checkout with coupon & city fee calculation
│   ├── thank-you/[orderNumber]/
│   ├── track-order/       # Phone/order-number lookup
│   └── account/           # Customer login, orders, digital downloads & addresses
├── components/
│   ├── admin/             # AdminShell, settings tabs, drag-and-drop editors
│   ├── storefront/        # Header, CartDrawer, QuickOrderForm, HomepageSections, Footer, etc.
│   └── tracking/          # Multi-pixel & CAPI event dispatcher
├── core/
│   ├── auth/              # Argon2id passwords, HMAC/SHA-256 session cookies, RBAC
│   ├── crypto/            # AES-256-GCM secret encryption & token hashing
│   ├── jobs/              # BullMQ queue + local async fallback + Redis SSE pub/sub
│   ├── migration-engine/  # SHARED <-> DEDICATED atomic migration & CLI
│   ├── security/          # sanitize-html, safe CSS sanitizer, Moroccan phone parser, rate limiting
│   ├── storage/           # StorageAdapter abstraction (Local filesystem & S3-ready)
│   └── tenancy/           # Host resolver, TenantPoolManager, withTenantDb context
├── db/
│   ├── schema/            # Control Plane & Tenant Data Plane Drizzle schemas
│   ├── migrate.ts         # SQL migrations + NOBYPASSRLS runtime role + FORCE RLS installer
│   ├── rls.ts             # RLS SQL generator across all 40 tenant tables
│   └── seed.ts            # Bilingual/trilingual sample store (Nabat Al Atlas)
└── services/              # Orders, Inventory (FOR UPDATE), Payments, Shipping, Email, WhatsApp, Digital
```

---

## Prerequisites & Local Development Setup

### Requirements
- Node.js `>= 22.x`
- PostgreSQL `>= 16` (`17` recommended)
- Redis `>= 7` (optional in local development; required in production for BullMQ worker & SSE fanout)

### 1. Install Dependencies & Configure Environment
```bash
npm install
cp .env.example .env
```

Generate cryptographic keys for `SESSION_SECRET` and `TENANT_ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure `.env`:
- `DATABASE_ADMIN_URL`: PostgreSQL superuser/owner URL (used ONLY for `db:migrate`, `db:seed`, and tenant migrations).
- `DATABASE_URL`: Restricted runtime role URL (`app_runtime` created automatically with `NOBYPASSRLS` during `db:migrate`).
- `CONTROL_DATABASE_URL`: Control Plane database URL (can point to the same PostgreSQL database as `DATABASE_ADMIN_URL` initially).

### 2. Initialize Database Schema, RLS & Seed Data
Ensure your target PostgreSQL database exists (e.g., `CREATE DATABASE nabat_atlas;`), then run:
```bash
npm run db:migrate
npm run db:seed
```

### 3. Run Development Servers
```bash
# Terminal 1: Next.js app server
npm run dev

# Terminal 2 (optional when Redis is running): BullMQ background worker
npm run worker:dev
```

- Storefront: `http://localhost:3000`
- Landing Page Example: `http://localhost:3000/lp/argan-atlas-offer`
- Admin Dashboard: `http://localhost:3000/admin/login` (credentials set via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`)

---

## Testing & Verification

```bash
# TypeScript type-check
npx tsc --noEmit

# ESLint checks
npm run lint

# Automated test suite (Vitest)
npm test

# Production bundle verification
npm run build
```

Note: Database integration tests under `tests/integration/` require a live PostgreSQL connection (`DATABASE_ADMIN_URL` / `CONTROL_DATABASE_URL` configured in `.env`) with migrations applied (`npm run db:migrate`). When PostgreSQL is unreachable or unconfigured in `.env`, integration suites skip safely while reporting unit/security results.

---

## Tenant Isolation Migration CLI (`SHARED <-> DEDICATED`)

Upgrade a high-traffic tenant to an isolated dedicated PostgreSQL database (or consolidate back to shared):

```bash
# Export snapshot backup -> Initialize target schema + RLS -> Batch import -> SHA-256 verify -> Switch routing
npm run tenant:migrate -- <tenant-slug> SHARED_TO_DEDICATED "postgresql://app_runtime:pass@dedicated-host:5432/tenant_db"

# Move back to shared PostgreSQL pool
npm run tenant:migrate -- <tenant-slug> DEDICATED_TO_SHARED
```

---

## Production Ubuntu VPS Deployment (Docker + Nginx + Let's Encrypt)

### 1. Provision Server & Environment
On your Ubuntu 24.04 VPS with Docker and Docker Compose v2 installed:
```bash
git clone <your-repo-url> /opt/nabat-atlas
cd /opt/nabat-atlas
cp .env.example .env
```

Update `.env` for production:
- `NODE_ENV=production`
- `APP_URL=https://yourdomain.com`
- `POSTGRES_USER=postgres` & `POSTGRES_PASSWORD=<strong-password>` & `POSTGRES_DB=nabat_atlas`
- Point `DATABASE_ADMIN_URL` and `CONTROL_DATABASE_URL` to `@postgres:5432/nabat_atlas`
- Point `DATABASE_URL` to `postgresql://app_runtime:<strong-runtime-password>@postgres:5432/nabat_atlas`
- `REDIS_URL=redis://redis:6379`
- Strong 64-char hex values for `SESSION_SECRET` and `TENANT_ENCRYPTION_KEY`

### 2. First Deploy & Database Setup
```bash
chmod +x scripts/*.sh
./scripts/deploy.sh

# Seed initial store catalog & Moroccan cities (first deployment only)
docker compose exec -T worker npm run db:seed
```

### 3. Enable HTTPS with Let's Encrypt
Point your domain's `A` record to your VPS public IP, then run:
```bash
./scripts/init-ssl.sh yourdomain.com admin@yourdomain.com
```
This obtains TLS certificates via Certbot, swaps Nginx into TLS 1.2/1.3 mode (preserving SSE unbuffered streaming for `/api/admin/notifications/stream`), and activates the automatic renewal service.

### 4. Backups & Disaster Recovery
```bash
# Manual backup (Control/Shared DB + any local Dedicated DBs + /app/storage media)
./scripts/backup.sh

# Automated daily backup via cron (03:00 AM)
# 0 3 * * * /opt/nabat-atlas/scripts/backup.sh >> /var/log/nabat-backup.log 2>&1

# Restore from a snapshot directory
./scripts/restore.sh backups/YYYYMMDD_HHMMSS
```

### 5. Health Check
- `GET /api/health` returns JSON diagnostics for PostgreSQL and Redis (`200` when healthy, `503` when database is unreachable).
