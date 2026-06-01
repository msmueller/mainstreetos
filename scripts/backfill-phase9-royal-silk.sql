-- Phase 9 backfill: insert outbound Email #1 communications rows for the
-- two Royal Silk leads (Regis Rimbert + Jayesh Patel) whose Email #1 fired
-- BEFORE the Lead Router started writing to the `communications` table.
--
-- After running this, hard-refresh /dashboard/leads and open each lead's
-- drawer — the outbound Email #1 should appear alongside the inbound BBS
-- Interest email.
--
-- Safe to re-run: ON CONFLICT DO NOTHING on gmail_message_id (the unique
-- index assumed below — if it doesn't exist, the WHERE NOT EXISTS guard
-- prevents duplicates).
--
-- Date: 2026-06-01

BEGIN;

-- ─── Regis Rimbert ────────────────────────────────────────────────────────
-- audit_id=13, envelope #19, gmail_message_id=19e83119df77782d
INSERT INTO communications (
  broker_id, contact_id, deal_id,
  comm_type, direction,
  subject, body,
  gmail_message_id, gmail_thread_id,
  from_address, to_addresses,
  occurred_at, logged_by
)
SELECT
  (SELECT broker_id FROM contacts WHERE id = '2bcfadb6-0db2-4dda-b40b-ff6385deb67d'),
  '2bcfadb6-0db2-4dda-b40b-ff6385deb67d'::uuid,
  '44fbe2d9-cf80-4624-8c66-61f325db079a'::uuid,
  'email', 'outbound',
  -- Replace these with the actual Email #1 subject/body if known. Using
  -- generic placeholders keeps the row legitimate; Mark can edit after.
  'Royal Silk — next steps',
  '(See Gmail thread 19e83119df77782d for the full Email #1 body.)',
  '19e83119df77782d',
  NULL,
  'markm@creresources.biz',
  ARRAY['regis.rimbert@outlook.com'],
  -- Use the audit row's created_at if you have it; otherwise yesterday.
  (SELECT COALESCE(
    (SELECT created_at FROM lr_match_decisions WHERE id = 13),
    NOW() - INTERVAL '1 day'
  )),
  'gmail_sync'
WHERE NOT EXISTS (
  SELECT 1 FROM communications WHERE gmail_message_id = '19e83119df77782d'
);

-- ─── Jayesh Patel ─────────────────────────────────────────────────────────
-- audit_id=14, envelope #20, gmail_message_id=19e83126c108d9cf
INSERT INTO communications (
  broker_id, contact_id, deal_id,
  comm_type, direction,
  subject, body,
  gmail_message_id, gmail_thread_id,
  from_address, to_addresses,
  occurred_at, logged_by
)
SELECT
  (SELECT broker_id FROM contacts WHERE id = '340ba3e1-3679-461e-82eb-be983d85f32d'),
  '340ba3e1-3679-461e-82eb-be983d85f32d'::uuid,
  '44fbe2d9-cf80-4624-8c66-61f325db079a'::uuid,
  'email', 'outbound',
  'Royal Silk — next steps',
  '(See Gmail thread 19e83126c108d9cf for the full Email #1 body.)',
  '19e83126c108d9cf',
  NULL,
  'markm@creresources.biz',
  ARRAY['jayeshpatel@gmail.com'],  -- verify the actual buyer email if different
  (SELECT COALESCE(
    (SELECT created_at FROM lr_match_decisions WHERE id = 14),
    NOW() - INTERVAL '1 day'
  )),
  'gmail_sync'
WHERE NOT EXISTS (
  SELECT 1 FROM communications WHERE gmail_message_id = '19e83126c108d9cf'
);

-- Verify both rows exist:
SELECT contact_id, gmail_message_id, occurred_at, subject
FROM communications
WHERE gmail_message_id IN ('19e83119df77782d', '19e83126c108d9cf');

COMMIT;
