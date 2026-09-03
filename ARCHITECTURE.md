# Clabane Academy — Architecture

## 1. Technology stack and rationale

Chosen after inspecting the actual development environment (Node 22,
Docker, and a local Postgres client were available — no existing project).

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | Next.js 14 (App Router), TypeScript | One deployable for a small internal app. Server Components and Route Handlers put authorization checks on the server by default — critical for "employees cannot access unauthorized videos." Mature, well-maintained, easy to self-host. |
| Styling | Tailwind CSS | Fast, consistent, accessible-by-default utility classes; no bespoke design system to build and maintain. |
| Database | PostgreSQL + Prisma ORM | Relational integrity for users, progress, and assessment attempts; Prisma gives real migrations, type-safe queries, and a schema that documents itself. |
| Authentication | Custom: bcrypt password hashing, JWT session in an httpOnly/secure/SameSite cookie, server-side RBAC guards, in-memory rate limiting | The spec's requirements (activation tokens, password reset, lockout, rate limiting, RBAC) are specific enough that a from-scratch implementation is more legible than adapting a generic auth framework's opinions. |
| Object storage | A `StorageService` abstraction implemented once against the **S3 API**, so it runs unchanged against AWS S3, Cloudflare R2, or MinIO (local dev) by changing only the endpoint/credentials | This is the mandatory requirement: video/document *files* never touch the relational database. Building to the S3 API (not a vendor SDK) is what makes "change providers later" a config change, not a rewrite. |
| Video delivery | Short-lived signed URLs issued server-side after an authorization check; the browser streams directly from object storage | Satisfies "don't load entire videos through the app server" and "never expose storage credentials to the browser" simultaneously. |
| Certificates | Generated server-side (`pdf-lib`) on completion, stored through the same `StorageService`, referenced by a `Certificate` metadata row | Reuses the storage abstraction rather than inventing a second file path. |
| Local dev infra | `docker-compose`: Postgres + MinIO | Mirrors production shape (Postgres + an S3-API store) without any cloud dependency. |
| Testing | Vitest against a dedicated Postgres test database | Fast, TypeScript-native, and able to exercise real Prisma queries rather than mocks for the business-logic layer (progress, scoring, certification). |
| Deployment | Docker image (multi-stage, Next.js `standalone` output) + managed Postgres + Cloudflare R2 | Small, cost-conscious, and portable across hosts. |

## 2. System architecture

```
Employee / Admin (browser)
        │  HTTPS
        ▼
Next.js application (Route Handlers + Server Components)
   ├─ Auth: bcrypt + JWT session cookie, RBAC guards on every route
   ├─ Business logic: src/lib/services/* (progress, assessment, certificate)
   └─ Storage abstraction: src/lib/storage (StorageService interface)
        │                                   │
        ▼                                   ▼
PostgreSQL                          Object storage (S3 API)
(users, progress,                   (video files, documents,
 assessments, metadata)              certificate PDFs)
        │
        ▼
  Signed, short-lived URL returned to the browser,
  which then streams/downloads directly from object storage.
```

The database and object storage never share responsibilities: Postgres
holds *rows that describe* a video/document/certificate (title, module,
lesson, storage key, size, MIME type, publish state); object storage holds
the *bytes*. No route ever proxies a full file through the Node process.

## 3. Database architecture

See `prisma/schema.prisma` for the authoritative schema. Entities, matching
the required list:

- `User` (role, status, credentials/activation/reset token hashes, lockout
  state) — `EmployeeProfile` (1:1, the employee-only fields)
- `Module` → `Lesson` → (`Video` | `Document`, plus inline `content` text) →
  `Assessment` → `Question` → `AnswerOption`
- `AssessmentAttempt` → `AttemptAnswer` (every attempt is a new row — nothing
  is overwritten, so "Attempt 1: 65%, Attempt 2: 75%..." is always
  reconstructable)
- `ModuleProgress`, `LessonProgress`, `VideoProgress` — one row per
  (employee, entity), each with a status/percentage and timestamps
- `Certificate` (unique `certificateNo`, storage reference)
- `AuditLog` (actor, action, entity, IP, timestamp, metadata)

Constraints worth calling out: `Assessment.moduleId` is `@unique` (one
assessment per module, matching the spec's one-assessment-per-module
model), `(moduleId, slug)` is unique on `Lesson`, `(assessmentId,
employeeId, attemptNumber)` is unique on `AssessmentAttempt`, and
`(employeeId, videoId)` / `(employeeId, lessonId)` / `(employeeId,
moduleId)` are unique on the three progress tables. Foreign keys cascade
where deleting the parent should remove the child (e.g. deleting a lesson
removes its videos' metadata rows — the storage objects themselves are
removed by the API route before the DB delete, see §4).

## 4. Video and document storage architecture

```
Admin uploads a file
        │
        ▼
POST .../upload-url   → validates MIME type + size, returns either:
                          (a) a signed PUT URL straight to the bucket (S3/R2/MinIO), or
                          (b) a server-upload fallback endpoint (local dev only, no
                              presigned-PUT support without a real S3-API endpoint)
        │
        ▼
Browser uploads the file directly to (a) or (b) — bytes never pass through
a Route Handler in production (a)
        │
        ▼
POST .../videos (or /documents) with the resulting storage key + metadata
        → writes ONE metadata row: provider, bucket, key, size, MIME type,
          duration, uploader, publish flag. No binary data in this call.
```

Playback/download works in reverse: an employee (or admin) requests
`GET /api/employee/videos/:id/stream-url`, the server checks that the video
**and** its lesson **and** its module are all published (§6), then returns
a signed URL with a short TTL (10 minutes) pointing directly at the object.
The `<video>` element's `src` is that URL, so range requests and streaming
are served by the storage layer, not the app server.

Deletion is symmetric and ordered to avoid orphans: `DELETE
/api/admin/videos/:id` calls `storage.deleteObject()` **before** deleting
the database row, and `deleteObject` is a no-op (not an error) if the
object is already gone — so a retried delete after a partial failure can
never leave a dangling reference, and a failed storage delete leaves the
metadata row in place rather than silently losing track of an object that
still exists.

Documents follow the identical shape (`Document` model, same upload/delete
routes pattern) — PDFs/DOCX/PPTX are never stored as bytes in Postgres.

### Storage provider decision

**Recommended for production: Cloudflare R2.** It speaks the S3 API (same
code path as AWS S3 and the MinIO instance used for local dev — see
`src/lib/storage/s3-provider.ts`), so switching to it is an environment
variable change (`STORAGE_PROVIDER=r2`, `STORAGE_ENDPOINT=...`), not a
rewrite. The deciding factor for an internal onboarding platform serving a
modest number of employees is **zero egress fees** — video is the one
workload here that's bandwidth-heavy, and R2 charges nothing to serve it,
versus ~$0.09/GB on S3. Storage itself is also cheaper per GB than S3. If a
future requirement demands AWS-native integration, `STORAGE_PROVIDER=s3`
uses the exact same code path.

## 5. Authentication architecture

- Passwords: bcrypt, 12 rounds, never returned in any API response and
  never visible to admins (there is no "view password" anywhere — admins
  can only trigger activation/reset links).
- Sessions: a JWT (HS256, `jose`) signed with `AUTH_SECRET`, stored in an
  `httpOnly`, `SameSite=Lax` cookie, `Secure` in production, 8-hour
  expiry. Verified in `middleware.ts` (edge, for redirect UX) **and** again
  in every Server Component/Route Handler via `requireAdmin` /
  `requireEmployee` / `getAuthorizedSession` (the actual authorization
  boundary — middleware is a convenience, not a substitute).
- Activation and password reset use single-use, time-boxed tokens: a random
  32-byte token is generated, only its SHA-256 hash is persisted, and it's
  invalidated the moment it's used. Email delivery is out of scope for
  Phase 1 (see `ARCHITECTURE.md` §10); the link is surfaced to the admin
  (activation) or returned in a dev-only response field (reset) so the flow
  is fully testable without an email provider.
- Failed logins increment a per-user counter; 5 consecutive failures lock
  the account for 15 minutes. Login and password-reset-request are also
  rate-limited per IP (in-memory sliding window — see `rate-limit.ts`;
  swappable for a shared store like Redis if the app is ever scaled
  horizontally).
- Every login, login failure, activation, password reset, and status change
  is written to `AuditLog`.

## 6. Security architecture

- **Server-side authorization everywhere**: every Route Handler starts with
  `getAuthorizedSession(allowedRoles)`; every protected Server Component
  starts with `requireAdmin()`/`requireEmployee()`. Client-side route
  hiding is not relied upon.
- **Unauthorized content access**: an employee can only ever obtain a
  signed URL for a video/document whose video, lesson, *and* module are all
  published — checked in the Route Handler, not the UI.
- **Input validation**: every mutating endpoint validates its body with a
  Zod schema (`src/lib/validation`) before touching the database.
- **File upload safety**: MIME type is restricted to an explicit allow-list
  and size-capped (2GB video / 25MB document) before a storage key is even
  issued.
- **Secrets**: all configuration in `.env.example`; nothing hardcoded;
  `.env` and `.env.test` (dummy dev-only secrets, safe to keep in version
  control for reproducible local testing) are the only files with actual
  values, and `.env` is git-ignored.
- **SQL injection / XSS**: Prisma parameterizes all queries; React escapes
  all rendered content by default (no `dangerouslySetInnerHTML` is used
  anywhere in the app).
- **Audit logging**: see `AuditLog` model — covers every action listed in
  the spec (employee created/deactivated/activated, logins and login
  failures, password resets, module/lesson/assessment authoring, video
  upload/replace/delete/publish, assessment submissions, certificate
  issuance).

## 7. Folder structure

See the **Project structure** section of `README.md`.

## 8. Development roadmap (phases, as built)

1. Architecture & technology selection (this document)
2. Project setup, Prisma schema, Docker Compose, storage abstraction
3. Authentication & RBAC (login, activation, reset, rate limiting, audit)
4. Employee onboarding flow & dashboard
5. Module/lesson system & admin content management
6. Video/document upload, secure signed delivery, admin management UI
7. Assessment engine (questions, scoring, 80% pass, retakes)
8. Progress tracking (lesson/video/module)
9. Certification (PDF generation, unique IDs, view/download)
10. Admin dashboard, employee management, reports/CSV export, audit log viewer
11. Security hardening (validation, rate limiting, lockout, headers)
12. Automated tests (Vitest) + seed data
13. README, Dockerfile, deployment documentation

## 9. Deployment architecture

```
                 ┌───────────────────────┐
   HTTPS  ─────▶ │  Next.js container     │
                 │  (Docker, standalone)  │
                 └──────────┬────────────┘
                            │
                 ┌──────────┴────────────┐
                 ▼                        ▼
        Managed PostgreSQL        Cloudflare R2 (S3 API)
        (production database)    (videos, documents, certs)
```

- **Development**: `docker compose up -d` (Postgres + MinIO) + `npm run dev`.
- **Staging/Production**: managed Postgres (e.g. RDS, Neon, Fly Postgres) +
  a real R2 bucket + the Docker image on any container host (Fly.io,
  Render, ECS, etc.), fronted by HTTPS (the host's TLS termination).
- Migrations are a separate release step (`prisma migrate deploy`) — never
  run automatically on container boot, so a bad migration can't silently
  fire on every restart.
- Application logs go to stdout (container-native; pipe to your platform's
  log aggregator). Error monitoring (e.g. Sentry) and database backups
  (automated by the managed Postgres provider) are the two operational
  pieces intentionally left to the hosting choice rather than baked into
  the app, since they're infrastructure decisions, not application code.

## 10. Notifications (explicitly deferred)

Per the spec, email notifications are not built in Phase 1. The seams are
already in place: employee creation and password-reset-request both
compute the exact link a "Welcome" or "Reset your password" email would
contain; wiring an email provider in later is a matter of calling it at
those two points instead of returning the link directly.

## 11. Cost estimate (initial small deployment)

Assumptions, per the brief: 50 employees, 5 modules, 5–10 videos per
module (7.5 avg), video size 150–500MB (325MB avg).

- Video storage: 5 × 7.5 × 325MB ≈ **12.2GB**
- Document storage: assume ~5 PDFs/module × 5MB ≈ **125MB**
- Database: metadata only (users, progress rows, attempts, audit log) —
  even with years of activity at this headcount, this stays in the
  **tens of MB**, not GB
- Bandwidth: the expensive case is new hires watching everything once;
  at ~5 new hires/month × 12.2GB ≈ **61GB/month egress**

| Item | Cost |
|---|---|
| R2 storage (12.2GB × $0.015/GB) | ~$0.20/month |
| R2 egress | **$0** (R2's defining advantage here) |
| Managed Postgres (small instance) | $0–19/month |
| App hosting (small container) | $5–25/month |
| **Total** | **roughly $15–45/month** |

For comparison, the same workload on S3 would add ~$5.50/month in egress
alone at this scale, growing linearly with new-hire volume — small today,
but exactly the kind of per-video cost the mandatory "object storage, not
the database" architecture was chosen to keep under control as the company
grows.

## 12. Final architecture verification

| # | Requirement | Status |
|---|---|---|
| 1 | Video files not stored in the relational database | ✅ `Video` model has no binary column, only `storageProvider/bucket/key` |
| 2 | Documents not unnecessarily stored in the relational database | ✅ same pattern via `Document` model |
| 3 | Videos stored in dedicated object storage | ✅ `StorageService` (S3-API: S3/R2/MinIO), local-disk fallback for zero-dependency dev only |
| 4 | Video metadata stored in the relational database | ✅ `Video` model |
| 5 | Storage credentials never exposed to the frontend | ✅ only short-lived signed URLs cross the network to the browser; verified by browser test |
| 6 | Employees cannot access videos of unauthorized modules | ✅ enforced server-side in `stream-url` route (checked: 403 on unpublished); verified by browser test |
| 7 | Video progress is tracked | ✅ `VideoProgress` (position, %, completed, timestamps) |
| 8 | Admins can upload/replace/publish/unpublish/delete videos | ✅ full CRUD + replace routes and UI; verified by browser test |
| 9 | Deleted content doesn't leave unmanaged storage objects | ✅ delete-object-then-row ordering, idempotent delete |
| 10 | Storage layer separated from business logic | ✅ `src/lib/storage` is the only place that imports an S3 SDK |
| 11 | Architecture supports future storage-provider migration | ✅ provider switch is an env var (`STORAGE_PROVIDER`) |
| 12 | Suitable for production hosting and future scaling | ✅ stateless app container, managed Postgres, object storage — horizontally scalable (rate limiter is the one component to move to a shared store first) |
| 13 | All sensitive configuration uses environment variables | ✅ `.env.example` |
| 14 | No secrets committed to the repository | ✅ `.env` git-ignored; `.env.test` holds only dummy, non-production values |
| 15 | Authentication and authorization are tested | ✅ unit tests (hashing, tokens, sessions, rate limiting) + manual browser verification of RBAC redirects/403s |
| 16 | Assessment scoring correctly enforces the 80% pass requirement | ✅ tested (`progress-and-assessment.test.ts`) and browser-verified fail→retake→pass |
| 17 | Assessment retakes are correctly recorded | ✅ every attempt is a new row; tested |
| 18 | Certificates only after all mandatory modules complete | ✅ `checkAndIssueCertificate`, tested including the idempotency case |
| 19 | Audit logging captures key admin/employee actions | ✅ `AuditLog`, verified present after login/module-creation in a live run |
| 20 | Complete onboarding journey works end-to-end | ✅ verified against a running instance: employee creation → activation → login → lessons → video upload/publish/watch/complete → assessment fail → retake → pass → repeat for all 5 modules → certificate issued → certificate downloaded as a real PDF |
