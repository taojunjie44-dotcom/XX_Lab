# Velocity Lab

A local-first personal VBT athlete monitoring web application.

## Run locally

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>.

## Quality checks

```bash
pnpm test
pnpm build
```

## Capabilities

- Daily readiness assessment and training recommendation
- Fast set-by-set load, reps, velocity and RPE logging
- Live velocity-loss monitoring
- Exercise-specific load–velocity profiles and estimated 1RM
- Session history with volume summaries
- Offline IndexedDB persistence and installable PWA
- JSON backup/restore and CSV export
- Athlete profile and per-exercise MVT configuration
- Username-only account switching and optional Supabase cross-device sync
- GitHub Pages continuous deployment workflow

## Optional cloud sync

Create a Supabase project, run `docs/supabase-schema.sql`, then copy
`apps/web/.env.example` to `apps/web/.env.local` and fill in the public project
URL and anon key. The username-only mode is intentionally not secure: anyone
who knows an account name can access that account's data.

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` builds and deploys every
push to `main`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository
Actions secrets before deployment when cloud sync is required.

Training recommendations are decision support, not medical advice.

