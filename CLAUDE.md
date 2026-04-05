# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is MainStreetOS

MainStreetOS is an AI-native deal operating system for business brokers. It automates business valuations using a multi-agent pipeline, generates deal documents, manages pipelines, and builds institutional memory via Open Brain semantic search.

## Commands

```bash
npm run dev       # Start Next.js dev server (http://localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint (Next.js web vitals + TypeScript)
```

No test framework is configured yet.

## Environment Variables

Copy `.env.local.example` to `.env.local`. Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side Supabase access (used by agents)
- `OPENROUTER_API_KEY` - AI model API for agent pipeline
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Billing (Phase 1)

## Architecture

**Stack**: Next.js 16 (App Router, React 19), TypeScript strict mode, Tailwind CSS 4, Supabase (PostgreSQL + Auth)

**Path alias**: `@/*` maps to `./src/*`

### Source Layout (`src/`)

- `app/` - Next.js App Router pages, layouts, and API routes
- `lib/agents/` - Business logic: the 3-agent valuation pipeline
- `lib/supabase/` - Supabase client (browser), server, and middleware helpers
- `lib/types.ts` - All shared TypeScript interfaces and domain types
- `middleware.ts` - Auth middleware protecting `/dashboard` routes

### Agent Pipeline (core business logic)

The valuation system runs a sequential 3-agent pipeline triggered via `POST /api/agents/normalize`:

1. **Agent 2 - Normalization** (`agent2-normalization.ts`, ~325 lines): Ingests multi-year financials, calculates SDE/EBITDA, auto-selects earnings metric based on revenue/industry, applies weighting (linear_recent, equal, custom).

2. **Agent 3 - Valuation Methods** (`agent3-valuation-methods.ts`, ~544 lines): Runs 5 parallel methods (Market Multiple, Cap of Earnings, DCF, Asset-Based, Rule of Thumb). Applies CSRP 8-factor risk scoring. Queries Open Brain for comparable deal context. Contains industry benchmarks for 7 sectors.

3. **Agent 4 - Synthesis** (`agent4-synthesis.ts`, ~131 lines): Calculates weighted FMV across all methods, determines defensible range based on dispersion coefficient, auto-captures results to Open Brain for future deal memory.

Data flow: User financial input -> Agent 2 (normalize) -> Agent 3 (5 methods + CSRP) -> Agent 4 (range + Open Brain capture)

### Auth Flow

Supabase Auth with password-based login/signup. Server actions in `app/auth/actions.ts`. OAuth callback at `app/auth/callback/route.ts`. Middleware redirects unauthenticated users to `/login`.

### Database Tables (Supabase)

- `users` - Profiles + subscription tiers (free/starter/professional/enterprise)
- `valuations` - Business metadata + status (draft/processing/review/complete/archived)
- `financial_data` - Line-item financials by fiscal year and category
- `valuation_methods` - Results from each of the 5 valuation methods
- `thoughts` - Open Brain semantic memory entries

### Key Domain Types (`lib/types.ts`)

- `FinancialCategory` enum: revenue, cogs, operating_expense, non_operating, owner_compensation, depreciation, amortization, interest, taxes, adjustment, sde_addback
- `ValuationMethodType`: market_multiple, capitalization_of_earnings, dcf, asset_based, rule_of_thumb
- `EarningsMetric`: sde, ebitda
- `SubscriptionTier` with `TIER_LIMITS` defining monthly valuation caps per tier
