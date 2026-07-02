-- Build A (2026-07-02): Completion → Notion LEAD write-back idempotency stamp.
-- Set after a successful Notion patch; the sync is skipped whenever it is
-- already set (guard: status='completed' AND notion_lead_id IS NOT NULL AND
-- notion_synced_at IS NULL). Also drives the one-time historical backfill.

alter table public.sign_envelopes
  add column if not exists notion_synced_at timestamptz;

comment on column public.sign_envelopes.notion_synced_at is
  'When this completed envelope was successfully written back to its Notion LEAD page. NULL = not yet synced (or sync disabled via NDA_NOTION_SYNC).';
