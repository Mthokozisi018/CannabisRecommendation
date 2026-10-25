# GreenChoice Workstation Agent Guide

## Setup

- Work from `greenchoice-workstation`.
- Install dependencies with `npm install`.
- Run the app with `npm run dev` and open `http://127.0.0.1:3001`.
- Local preview mode uses synthetic GreenChoice staff data when Supabase env vars are absent.

## Validation

- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Unit/integration tests: `npm run test`
- E2E tests: `npm run test:e2e`
- Production build: `npm run build`

## Notes

- Keep customer-facing cannabis language informational and preference-focused.
- Re-check authorization in UI routes, server actions, DAL/API handlers and export/report paths.
- Do not expose `platform_super_admin` in tenant-facing role pickers.
- Sensitive account actions should use step-up protection and structured audit events.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
