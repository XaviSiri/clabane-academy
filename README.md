# Clabane Academy

Clabane Academy is an internal employee onboarding and training platform — a
Learning Management System, not a video library. Administrators build
onboarding programmes out of modules, lessons, videos, documents, and
assessments; employees work through them, get graded against an 80% pass
mark, and receive a certificate once every mandatory module is complete.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the technology choices,
system/database/storage/security architecture, cost estimate, and the
final architecture verification checklist.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (a local instance, or via Docker)
- Docker (optional but recommended for local object storage via MinIO)

## Installation

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — point at your local Postgres.
- `AUTH_SECRET` — generate one with `openssl rand -base64 48`.
- `STORAGE_PROVIDER` — `minio` for local development (see below), `local`
  for a zero-dependency disk-backed fallback, or `r2`/`s3` in production.

## Database setup

Bring up Postgres (and MinIO for S3-compatible local object storage) with
Docker:

```bash
docker compose up -d
```

If you'd rather use an existing local Postgres install, just point
`DATABASE_URL` at it and set `STORAGE_PROVIDER=local` (no MinIO/Docker
required — files are written under `.local-storage/`).

### Migrations

```bash
npm run db:migrate       # applies migrations locally, prompting for a name on schema changes
npm run db:migrate:deploy  # non-interactive, for CI/production
```

### Seed data

```bash
npm run db:seed
```

This creates:

- **1 administrator**: `admin@clabane.example` / `AdminPass123`
- **2 demo employees**:
  - `jane.doe@clabane.example` / `EmployeePass123` (active)
  - `sam.smith@clabane.example` (pending activation — demonstrates the
    activation flow)
- **5 onboarding modules** (Who We Are, How We Work, Our Products, Customer
  Experience, Data and Security), each with 3–4 lessons, a published
  assessment, and sample questions
- Sample (unpublished) video metadata demonstrating the video metadata shape
  without needing a real upload
- All Clabane-specific content is a `[INSERT ...]` placeholder — no company
  facts are invented, per the platform's content policy. Administrators
  replace these through Content Management.

## Running locally

```bash
npm run dev
```

Visit `http://localhost:3000`. You'll be redirected to `/login`.

## Creating an administrator

There is no self-serve admin signup (by design — this is an internal tool).
Promote a user directly, or add one via a one-off script:

```bash
npx tsx -e "
import { prisma } from './src/lib/db';
import { hashPassword } from './src/lib/auth/password';
(async () => {
  await prisma.user.create({
    data: {
      email: 'newadmin@clabane.example',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: await hashPassword('ChangeMe123'),
      profile: { create: { fullName: 'New Admin' } },
    },
  });
})();
"
```

## Creating an employee

As an admin, go to **Employees → + Add Employee**. This creates a
`PENDING_ACTIVATION` account and returns an activation link (email delivery
is intentionally out of scope for Phase 1 — see **Notifications** in
`ARCHITECTURE.md` — so the link is shown directly to the admin to share).
The employee visits the link, sets a password, and can then log in.

## Adding a module (no code required)

**Admin → Content**, then **+ New Module**. Give it a title and a slug.
Open the module to add lessons, and use **Manage assessment** to add
questions and set the pass mark. Nothing is published to employees until you
explicitly publish the module, its lessons, and its assessment.

## Uploading a video

Inside a lesson (**Admin → Content → [module] → [lesson]**), use the
**Upload New Video** panel: pick a file, give it a title, and submit. The
browser uploads directly to object storage (a short-lived signed PUT URL —
storage credentials never reach it); once the upload finishes, its metadata
is written to the database and the video appears as a draft. Click
**Publish** to make it visible to employees. Videos are streamed to
employees via short-lived signed URLs, never a public storage path.

## Creating an assessment

From a module's page, click **Manage assessment** (or **Create assessment**
if none exists yet), set a title and pass mark (defaults to 80%), then add
Multiple Choice or True/False questions with one or more correct options.
Publish the assessment once ready — employees can't start it until all of
the module's lessons are marked complete.

## Running tests

```bash
npm test
```

This runs the automated suite (`vitest`) against a **dedicated test
database** — set `DATABASE_URL` in `.env.test` (already pointed at
`clabane_academy_test` by default; create that database once with
`createdb clabane_academy_test` or the equivalent). Migrations are applied
automatically before the suite runs, and every table is truncated between
tests for isolation.

The suite covers the business logic layer directly (password hashing,
session tokens, rate limiting, the storage abstraction, lesson/module
progress, video completion thresholds, assessment scoring and the 80% pass
rule, retake history, and certificate issuance/idempotency). The full HTTP
and browser-level journey — login, RBAC redirects, employee onboarding
end-to-end through certification, video upload/publish/unpublish/delete,
and unauthorized-access enforcement — was additionally verified manually
against a running instance during development; see `ARCHITECTURE.md` for
what was checked.

## Building for production

```bash
npm run build
npm start
```

Or build the Docker image:

```bash
docker build -t clabane-academy .
docker run -p 3000:3000 --env-file .env clabane-academy
```

Run `npx prisma migrate deploy` against the production database as a
release step — the Docker image does not run migrations on boot.

## Deployment

See **Deployment Architecture** in `ARCHITECTURE.md`. In short:

1. Provision a managed Postgres instance (production database).
2. Provision an S3-compatible bucket — Cloudflare R2 is the recommended
   default (see the cost/architecture rationale in `ARCHITECTURE.md`).
3. Set all variables from `.env.example` as real secrets in your hosting
   provider (never commit `.env`).
4. Run `npx prisma migrate deploy`.
5. Deploy the Docker image (or `next build && next start`) behind HTTPS.
6. Point `APPLICATION_URL` at the real domain (used in activation/reset
   links).

## Project structure

```
prisma/                  Database schema, migrations, seed script
src/
  app/                    Next.js App Router pages and API routes
    (employee)/           Employee-facing pages (dashboard, modules, lessons, assessments, certificate)
    (admin)/admin/         Admin dashboard, employee/content/video/document/assessment management, reports, audit logs
    api/                   Route handlers (auth, admin, employee)
  components/             Shared UI + admin-only components
  lib/
    auth/                 Password hashing, sessions (JWT), RBAC guards, tokens, rate limiting
    storage/              StorageService abstraction + S3-API and local providers
    services/             Business logic: progress, video-progress, assessment, certificate
    validation/           Zod schemas (auth + content)
    audit.ts              Audit log writer
tests/                    Vitest suite + fixtures
docker-compose.yml        Local Postgres + MinIO for development
Dockerfile                Production image
```
