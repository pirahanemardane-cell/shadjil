# Architecture - shadjil.ir

Version: 1.1 | 2026-10-20 | Status: pre-launch (noindex)

## Goal
Specialized nuts, dried fruit, dates, and souvenirs store (شادجیل) with Persian UX, real inventory, Iranian shipping, simple admin.

## Stack
- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- Auth + DB: Supabase (Auth, Postgres, RLS, Realtime)
- Hosting: Vercel (region: fra1)
- CDN / WAF: Cloudflare
- Files / Backup: Cloudflare R2
- Monitoring: Sentry
- Rate Limit: Upstash Redis

## Request flow
User -> Cloudflare -> Vercel (fra1) -> Next.js
Then: Supabase | R2 | Upstash | Sentry

## Important folders
- src/app/(shop) = storefront
- src/app/admin = admin panel
- src/app/api = route handlers
- src/lib = business logic (business-rules, shipping, cart, seo, ...)
- supabase/migrations = database changes
- docs/ = phase status and rules

## Business rules (single source)
File: src/lib/business-rules.ts
- Return window and allowed statuses
- Customer cancel allowed statuses
- Change rules only in that file

## Security summary
- RLS on sensitive tables
- Rate limit on auth / contact / search
- Security headers + HSTS + basic CSP
- Service Role only server-side
- Gitleaks in CI
- No secrets in client or commits

## Deploy
- Push to main -> automatic Vercel deploy
- Region: fra1
- Daily backup cron: /api/cron/backup -> R2
- Health: GET /api/health

## Current status
- Phases 0-4: skeleton closed (return/cancel rules centralized)
- Phases 5-16: catalog, content, product, search, cart, checkout, orders, shipping, discounts, reviews, basic SEO mostly done
- Phase 11 (Iranian payment gateway): paused until ready
- Google index: still noindex until real content + final QA

## Next priorities
1. Real product content + About / FAQ / size guide
2. Iranian payment gateway (phase 11)
3. Fine-grained permissions + mobile OTP (remaining phase 4)
4. Unit / integration / E2E tests (phase 25)
5. Separate staging + enable indexing after QA
