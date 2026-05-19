# Boffin SEO v2

Evidence-first SEO operating system. Clean V2 rebuild of `/Users/boffincoders/Manoj/Projects/boffincoders-seo`.

## Stack

- **Monorepo**: pnpm + turbo
- **Web**: Next.js 16 (App Router) + React 19.1 + Tailwind 4 + Ant Design 5 + Recharts
- **Backend**: Express 4 + Agenda 6 (Mongo backend) + Mongoose
- **DB**: MongoDB only (no Redis)
- **Runtime**: tsx (dev), tsup (prod bundle). Extensionless TS imports throughout.

## Layout

```
apps/
  web/        — Next 16 frontend
  backend/    — Express + Agenda + Mongoose (single backend, no separate worker)
packages/
  schemas/    — shared Zod contracts + types
```

Everything else (crawler, audit, AI router, integrations, reports, domain) lives **inside** `apps/backend/src/`. Doc 3 said split into packages "yet" so this codebase keeps them as backend modules until justified.

## Backend modules

```
apps/backend/src/
  config/        — env validation, pino logger
  db/            — Mongoose connection + models
  crawler/       — fetchers, robots, sitemap, extractors, BFS orchestrator
  audit/         — rule contract, registry, runner, finding/issue persistence
  ai/            — provider clients + dynamic router + evidence analyzer
  integrations/  — Google OAuth, GSC, GA4, CWV (PSI)
  reports/       — initial-audit, weekly, monthly markdown builders
  domain/        — lifecycle service, project/run/profile orchestration
  jobs/          — Agenda bootstrap + handlers + job registry
  http/          — Express routes (projects, runs, issues, pages, reports, profile, schedules, workspace)
  index.ts       — boots mongo → agenda → http in single process
```

## Frontend

- Theme tokens in `apps/web/src/styles/tokens.ts` (single source of truth)
- CSS variables in `apps/web/src/styles/globals.css` (Tailwind 4 `@theme`)
- Antd `ConfigProvider` theme in `apps/web/src/theme/antd-theme.ts`
- Recharts palette in `apps/web/src/theme/chart-colors.ts` (`chartColors.severity.critical` etc.)
- Layout primitives: `AppShell`, `PageHeader`, `SectionCard`, `MetricTile`, `StatusPill`, `EmptyState`
- React Query polls backend run records (no SSE/websocket yet)
- No inline styles in pages

## AI router

Dynamic provider selection in `apps/backend/src/ai/router.ts`:

- cheap tier: prefer env default → local → groq → openai
- premium tier: openai → anthropic → groq → local
- **Anthropic is escalation-only**, never default
- Configure via env: `AI_DEFAULT_PROVIDER`, `AI_LOCAL_MODEL_URL`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

## Run

```bash
cp .env.example .env
docker compose up -d mongo crawl4ai
pnpm install
pnpm dev   # backend on :7010, web on :7011
```

`pnpm typecheck` validates all 3 packages. `pnpm build` produces `apps/backend/dist/index.js` (tsup-bundled) and `apps/web/.next`.

## Lifecycle

```
needs-setup → ready-for-first-crawl → crawling → crawl-needs-review
            → ready-for-initial-audit → auditing
            → ready-for-ai-analysis → profile-needs-review
            → active-issues → ready-to-report → monitoring
            → verification-needed
```

State is **derived from records**, never trusted from storage. See `apps/backend/src/domain/lifecycle.ts`.

## What's deferred

- PDF rendering (reports are markdown only)
- GBP/Maps/backlinks/keyword providers
- Auth (no users/sessions; designed so it can be added cleanly)
- Verify-fixes auto-flip from `fixed-pending-verification` → `verified` when matching rule passes (runs re-audit only)

## Validation status

`pnpm typecheck` passes. `pnpm -F @boffin/web build` passes. End-to-end runtime validation against live MongoDB, Crawl4AI, and AI providers requires your environment + keys.
