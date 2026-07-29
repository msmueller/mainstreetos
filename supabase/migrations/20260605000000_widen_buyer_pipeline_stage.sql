-- Widen buyer_pipeline_stage enum 8 -> 11 to match the canonical Notion LEADS
-- `Pipeline Stage` select (adds the three terminal stages). Part of the
-- 2026-06-05 Notion ↔ Attio alignment. src/lib/router/buyer-axes.ts is the
-- lockstep source of truth for these values and their Notion display labels.
--
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in
-- some Postgres versions; if applying via a tool that wraps statements in a
-- transaction, run these one at a time.

ALTER TYPE buyer_pipeline_stage ADD VALUE IF NOT EXISTS 'closed_won';
ALTER TYPE buyer_pipeline_stage ADD VALUE IF NOT EXISTS 'closed_lost';
ALTER TYPE buyer_pipeline_stage ADD VALUE IF NOT EXISTS 'withdrawn';
