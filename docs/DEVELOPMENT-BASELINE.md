# Personal VBT Athlete Monitoring System — Development Baseline

Status: v1 application implemented and production build verified on 2026-09-29.

## Recommended baseline

- React + Vite + TypeScript
- Progressive Web App with offline support
- shadcn/ui + Tailwind CSS for accessible UI primitives
- Dexie/IndexedDB for local-first structured data
- Recharts for standard training and readiness charts
- Zod for runtime validation and data import boundaries
- TanStack Router for typed application routes
- Vitest + Testing Library + Playwright for verification
- Optional later sync: Supabase/PostgreSQL, introduced behind a repository interface

## Product constraints guiding the stack

1. A training session must remain recordable without a network connection.
2. Set entry should be comfortable on a phone between sets.
3. Raw observations must be preserved separately from derived metrics.
4. Every readiness or recommendation score must show its inputs and confidence.
5. CSV/JSON export must exist before cloud sync is introduced.
6. Algorithms are versioned so historical recommendations remain explainable.

## Planned workspace shape

```text
apps/
  web/                 # React/Vite PWA implementation
packages/
  domain/              # VBT entities and calculation contracts
  analytics/           # LVP, e1RM, velocity loss, readiness
  data/                # persistence interfaces and migrations
docs/
  DEVELOPMENT-BASELINE.md
outputs/
  vbt-webapp-resource-research.md
```

## Deferred decisions

- Validation and future personalization of the readiness formula weighting
- Exercise-specific MVT defaults versus athlete-calibrated values
- Whether cloud sync is needed at all for v1
- Device/Bluetooth ingestion scope
- Hosting provider
