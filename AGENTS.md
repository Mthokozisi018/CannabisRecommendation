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
