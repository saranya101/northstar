# Northstar

Northstar is a behavioural academic operating system for university students. It is intended to bring academic planning, progress, and evidence into one coherent application while helping students understand and improve how they study.

This repository is currently the application foundation only. It does not yet contain product features, sample data, database integration, authentication, AI, or vector search.

## Locked stack

- Nuxt 4 and Vue 3
- JavaScript-first application code; Nuxt-generated TypeScript configuration may remain
- Nuxt UI and Tailwind CSS
- npm and npx only
- Neon PostgreSQL with Prisma ORM (planned)
- Better Auth (planned)
- Zod (planned)
- Neon pgvector (planned for a later phase)
- Vitest and Playwright (planned)

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
```

Use `npm ci` in continuous integration for reproducible installs. Test commands will be documented when Vitest and Playwright are introduced.

## Environment variables

Copy `.env.example` to `.env` only when local configuration is needed. The example file must contain placeholders, never credentials or production values.

- Prefix browser-readable values with `NUXT_PUBLIC_`.
- Keep secrets server-only and access them through Nuxt runtime configuration.
- Never commit `.env` or other populated environment files.
- Add every required variable to `.env.example` with an empty or clearly synthetic value.
- Database and authentication variables are intentionally omitted until those integrations are added.

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
  services/       Server-side business and integration logic
  utils/          Server-only utilities
shared/
  schemas/        Zod schemas shared across application boundaries
tests/            Vitest and Playwright tests and supporting fixtures
```

Keep route handlers thin: validate input, call a service, and shape the response. Shared schemas define boundary contracts, while server-only credentials and infrastructure logic stay under `server/`.
