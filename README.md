# Northstar

Northstar is a behavioural academic operating system for university students. It is intended to bring academic planning, progress, and evidence into one coherent application while helping students understand and improve how they study.

This repository currently contains the application foundation, Neon/Prisma infrastructure, email/password authentication, authenticated academic onboarding, and the Phase 4A module catalogue and semester-enrolment foundation. It does not yet contain timetables, assessments, behavioural activity, AI, or vector search.

## Locked stack

- Nuxt 4 and Vue 3
- JavaScript-first application code; Nuxt-generated TypeScript configuration may remain
- Nuxt UI and Tailwind CSS
- npm and npx only
- Neon PostgreSQL with Prisma ORM
- Better Auth
- Zod
- Neon pgvector (planned for a later phase)
- Vitest and Playwright (Playwright planned)

Do not convert this application into a monorepo or use pnpm, Yarn, or Bun. Keep `package-lock.json` under version control.

## Requirements

- Node.js `^22.19.0`, `^24.11.0`, or `>=26.0.0`
- npm `>=10.0.0`

## npm commands

```bash
npm install        # Install dependencies from package-lock.json
npm run dev        # Start the development server
npm run build      # Create a production build
npm run generate   # Generate a static deployment
npm run preview    # Preview the production build locally
npm run db:validate # Validate the Prisma schema and configuration
npm run db:generate # Generate the server-only Prisma Client
npm run db:migrate  # Create and apply a development migration
npm run db:seed     # Idempotently load approved reference data
npm run db:deploy   # Apply committed migrations in production
npm run db:studio   # Open Prisma Studio
npm run auth:generate # Regenerate the Better Auth Prisma schema
npm run auth:info   # Inspect the Better Auth configuration
npm run test        # Run Vitest in watch mode
npm run test:run    # Run the test suite once
```

Use `npm ci` in continuous integration for reproducible installs.

## Environment variables

Copy `.env.example` to `.env` only when local configuration is needed. The example file must contain placeholders, never credentials or production values.

- Prefix browser-readable values with `NUXT_PUBLIC_`.
- Keep secrets server-only and access them through Nuxt runtime configuration.
- Never commit `.env` or other populated environment files.
- Add every required variable to `.env.example` with an empty or clearly synthetic value.
- Database variables are server-only and must never use the `NUXT_PUBLIC_` prefix.
- `BETTER_AUTH_SECRET` must be a high-entropy secret of at least 32 characters.
- `BETTER_AUTH_URL` must exactly match the application origin. Production must use its HTTPS origin.

## Neon and Prisma

Create a Neon project and copy its two PostgreSQL connection strings into a local `.env` file:

```dotenv
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
DIRECT_URL="postgresql://.../neondb?sslmode=require"
```

`DATABASE_URL` is Neon's pooled application connection. Northstar passes it to the Neon serverless Prisma adapter at runtime. `DIRECT_URL` is the non-pooled connection used by the Prisma CLI for schema validation, migrations, deployment, and Studio. Neither value belongs in Nuxt public runtime configuration, logs, browser code, or version control.

Never commit `.env`. The committed `.env.example` contains empty placeholders only.

The normal Prisma workflow is:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate -- --name <migration-name> # Development only
npm run db:deploy                              # Production and CI/CD
```

Do not use `prisma db push`. Northstar uses reviewed, committed SQL migrations. Better Auth owns the `User`, `Session`, `Account`, and `Verification` identity models. Phase 3 adds separate academic profile models without changing Better Auth's authentication fields.

The Phase 3 seed contains only approved reference data for Nanyang Technological University, Nanyang Business School, and the Business programme. It is idempotent. No `AcademicTerm` is seeded because official dates have not been supplied; students enter a custom term from their official university calendar until reviewed term reference data is added.

`GET /api/health/database` executes a parameter-free `SELECT 1` and returns only `{"status":"healthy"}` or `{"status":"unhealthy"}`. Failed checks use HTTP 503 and log only a generic server-side message.

## Better Auth

Authentication uses Better Auth's Prisma adapter and database-backed cookie sessions. The server configuration is isolated under `server/`, while the Vue client makes same-origin requests through `/api/auth`. No token is stored manually in browser storage.

Local `.env` configuration:

```dotenv
DATABASE_URL="<pooled Neon application connection>"
DIRECT_URL="<direct Neon Prisma CLI connection>"
BETTER_AUTH_SECRET="<high-entropy secret>"
BETTER_AUTH_URL="http://localhost:3000"
```

Never commit `.env`, authentication secrets, session tokens, or database URLs. Use the production HTTPS origin for `BETTER_AUTH_URL` in production.

After changing authentication options or plugins, inspect schema changes before applying them:

```bash
npm run auth:generate
npm run db:validate
npm run db:migrate -- --name <migration-name> # Development
npm run db:generate
npm run db:deploy                              # Production
```

### Manual authentication verification

1. Confirm `GET /api/health/database` returns `{"status":"healthy"}`.
2. Open `/signup` and create a new account with a unique email.
3. Use Prisma Studio or a safe database console to confirm corresponding `User`, credential `Account`, and `Session` records exist. Never inspect or copy password hashes or session tokens.
4. Open `/app` and confirm the signed-in name or email appears.
5. Refresh `/app` and confirm the cookie-backed session persists.
6. Log out and confirm `/app` redirects to `/login`.
7. Log in again, then confirm `/login` redirects to `/app`.
8. Log out and confirm `GET /api/auth/me` returns HTTP 401.

Email verification, password-reset email, and social login are intentionally deferred.

## Student onboarding

New authenticated users are sent to `/onboarding` before `/app`. Each profile, academic, semester, and study-preference step is validated with shared Zod schemas and saved independently to PostgreSQL. The saved `Profile.onboardingStep` supports resuming after refresh, sign-out, or a later session. Completion is a separate server action and succeeds only after all mandatory records exist.

All user ownership comes from the Better Auth session on the server. API bodies never accept a `userId`. University, school, and programme relationships are checked server-side, and the current semester is switched in a transaction so application logic leaves only one active semester per user.

The onboarding API is server-only and exposed through authenticated routes under `/api/onboarding`. Completed users can update the same foundation at `/app/settings`; these edits reuse the onboarding forms and validation but do not reset completion.

## Module catalogue and enrolments

Phase 4A separates reusable academic records from each student's private semester state:

- `Module` is the university-scoped, permanent catalogue identity for a module.
- `ModuleOffering` represents that module in one academic term and section. Blank sections are normalised to the stable `DEFAULT` label.
- `UserModuleEnrolment` belongs to the authenticated student and active `UserSemester`. It contains private target grade, colour, notes, and enrolment status.
- `Instructor` is a university-scoped teaching-person record. `InstructorAssignment` connects that instructor to an offering in a specific role.

Dropping or archiving changes only `UserModuleEnrolment`; it never deletes the shared module, offering, instructor, or assignment records. Server services derive ownership from the Better Auth session and never accept a client-supplied user ID.

Source status is explicit. `USER_ENTERED` data was supplied by a Northstar user and is never presented as official. `UNVERIFIED`, `OFFICIAL_HISTORICAL`, and `OFFICIAL_CURRENT` leave room for reviewed enrichment. Official NTU catalogue and instructor enrichment will be introduced later from approved public sources; Phase 4A neither scrapes nor guesses that information.

Module colours are semantic identifiers stored as `MINERAL`, `OCEAN`, `FOREST`, `AMBER`, `TERRACOTTA`, `INDIGO`, `SLATE`, or `ROSE`. Interfaces always display a text label alongside colour selection.

Authenticated, onboarded module routes:

```text
GET    /api/modules                    List the student's active-semester enrolments
GET    /api/modules/search?q=          Search the student's university catalogue
POST   /api/modules                    Create/reuse a manual module and enrol
POST   /api/modules/enrol              Enrol in an existing catalogue module
GET    /api/modules/:id                Read an owned enrolment dossier
PATCH  /api/modules/:id                Update private enrolment settings
DELETE /api/modules/:id?mode=drop      Soft-drop or archive an enrolment
POST   /api/modules/:id/instructors    Add/reuse teaching staff for an owned offering
```

After changing the module schema, use the normal committed-migration workflow:

```bash
npm run db:validate
npm run db:migrate -- --name <migration-name>
npm run db:generate
npm run db:seed
npm run test:run
```

Production applies reviewed migrations with `npm run db:deploy`; never use `prisma db push`. Timetable and recurring class sessions are the next planned phase.

## Planned architecture

```text
app/
  assets/css/     Global Tailwind and Nuxt UI CSS entry point
  components/     Reusable presentation and domain components
  composables/    Reusable client-side state and behaviour
  layouts/        Application page shells
  middleware/     Nuxt route middleware
  pages/          File-based application routes
  utils/          Browser-safe application utilities
server/
  api/            Nitro API route handlers
  generated/      Generated server-only Prisma Client (not committed)
  services/       Server-side business and integration logic
  utils/          Server-only utilities
prisma/
  migrations/     Committed Prisma SQL migrations
  schema.prisma   Database provider and domain schema
shared/
  schemas/        Zod schemas shared across application boundaries
tests/            Vitest and Playwright tests and supporting fixtures
```

Keep route handlers thin: validate input, call a service, and shape the response. Shared schemas define boundary contracts, while server-only credentials and infrastructure logic stay under `server/`.

## Nuxt composable safety

Initialise all Nuxt, Vue and Nuxt UI composables synchronously before the first await. Async methods must use references captured when the composable, page, layout or middleware was entered.

Custom composables are synchronous factories. They capture `useNuxtApp`, `useRequestFetch`, shared state, routing, and UI helpers before returning async methods. Middleware restores Nuxt context only around navigation that occurs after an async boundary. Session, onboarding, and module request promises are kept on the current Nuxt application instance, never in serialised state or a server-global promise, so concurrent callers deduplicate without leaking data between SSR requests.
