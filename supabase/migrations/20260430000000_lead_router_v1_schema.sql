-- ============================================================================
-- Lead Router v1 schema (Paradigm B2 — Gmail API direct)
-- ============================================================================
-- Adopts existing infrastructure as-is:
--   email_sequences, sequence_steps, sequence_enrollments, sequence_sends,
--   email_threads, email_messages, seller_listings, buyer_leads,
--   communications, ai_routing_log
--
-- Adds three new tables:
--   lr_templates           — picker registry, maps (category, listing, industry)
--                            to an email_sequence
--   lr_match_decisions     — per-routing audit row
--   lr_suppressed_emails   — global suppression list
--
-- Extends one existing table:
--   seller_listings        — adds 7 link/number columns
--
-- See docs/LEAD-ROUTER-SPEC.md (v2) for design rationale.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXTEND seller_listings with deal-document link fields
-- ----------------------------------------------------------------------------

ALTER TABLE seller_listings
  ADD COLUMN listing_number text,
  ADD COLUMN bbs_link       text,
  ADD COLUMN om_link        text,
  ADD COLUMN cim_link       text,
  ADD COLUMN bvr_link       text,
  ADD COLUMN workbook_link  text,
  ADD COLUMN nda_link       text;

COMMENT ON COLUMN seller_listings.listing_number IS
  'External listing reference; typically the BizBuySell listing # for BBS-sourced listings.';
COMMENT ON COLUMN seller_listings.bbs_link IS
  'Public BizBuySell listing URL.';
COMMENT ON COLUMN seller_listings.om_link IS
  'Pre-NDA Offering Memorandum URL (shareable to prospects before NDA).';
COMMENT ON COLUMN seller_listings.cim_link IS
  'Post-NDA Confidential Information Memorandum URL.';
COMMENT ON COLUMN seller_listings.bvr_link IS
  'Post-NDA Business Valuation Report URL.';
COMMENT ON COLUMN seller_listings.workbook_link IS
  'Post-NDA Deal Workbook URL.';
COMMENT ON COLUMN seller_listings.nda_link IS
  'Per-listing NDA execution link (DocuSign / HelloSign / etc.).';

-- Sparse index for BBS reference resolution during matching
CREATE INDEX idx_seller_listings_listing_number
  ON seller_listings(listing_number)
  WHERE listing_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. lr_templates — Lead Router template registry (picker layer)
-- ----------------------------------------------------------------------------
-- Templates are a routing/picker layer over the existing sequence_steps
-- content. A template row maps (category, listing_id?, industry_tags?,
-- listing_type) to an email_sequence. Picker priority:
--   1. listing_id match (per-listing override)
--   2. industry_tags overlap (per-industry)
--   3. generic (listing_id IS NULL, industry_tags = '{}', listing_type = 'any')
--
-- Once matched, the Router enrolls the buyer_lead into the bound email_sequence
-- via sequence_enrollments. Subject + body content lives in sequence_steps,
-- not here. lr_templates is metadata-only.

CREATE TABLE lr_templates (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  category            text NOT NULL,
  industry_tags       text[]      NOT NULL DEFAULT '{}',
  listing_type        text        NOT NULL DEFAULT 'any',
  listing_id          uuid        REFERENCES seller_listings(id) ON DELETE SET NULL,
  email_sequence_id   uuid        NOT NULL REFERENCES email_sequences(id) ON DELETE RESTRICT,
  broker_id           uuid,                                       -- v1: nullable; v1.1 SaaS: NOT NULL
  active              boolean     NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lr_templates_category_check CHECK (
    category IN ('initial_response', 'nda_request', 'cim_followup',
                 'loi_received', 'due_diligence', 'closing', 'unmatched')
  ),
  CONSTRAINT lr_templates_listing_type_check CHECK (
    listing_type IN ('any', 'biz', 'cre')
  )
);

COMMENT ON TABLE lr_templates IS
  'Lead Router template registry. Maps (category, listing_id, industry, listing_type) to an email_sequence. Content lives in sequence_steps.';

CREATE INDEX idx_lr_templates_category_active
  ON lr_templates(category)
  WHERE active = true;

CREATE INDEX idx_lr_templates_listing
  ON lr_templates(listing_id)
  WHERE listing_id IS NOT NULL;

CREATE INDEX idx_lr_templates_industry_gin
  ON lr_templates USING GIN(industry_tags);

-- updated_at trigger
CREATE OR REPLACE FUNCTION lr_templates_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lr_templates_updated_at
  BEFORE UPDATE ON lr_templates
  FOR EACH ROW
  EXECUTE FUNCTION lr_templates_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. lr_match_decisions — Routing decision audit log
-- ----------------------------------------------------------------------------
-- One row per Router invocation. Idempotency enforced by partial unique index
-- on (buyer_lead_id) WHERE status = 'enrolled' AND dry_run = false.
-- Reroutes mark the prior 'enrolled' row 'superseded' before inserting new.

CREATE TABLE lr_match_decisions (
  id                          bigserial PRIMARY KEY,
  buyer_lead_id               uuid        REFERENCES buyer_leads(id) ON DELETE CASCADE,
  notion_lead_page_id         text,
  inquiry_gmail_message_id    text,                                       -- raw Gmail msg ID for forensics
  matched_listing_id          uuid        REFERENCES seller_listings(id) ON DELETE SET NULL,
  matched_scenario            text,
  match_confidence            numeric(3,2),
  match_reasoning             text,
  extracted_attributes        jsonb,
  template_id                 text        REFERENCES lr_templates(id) ON DELETE SET NULL,
  email_sequence_id           uuid        REFERENCES email_sequences(id) ON DELETE SET NULL,
  sequence_enrollment_id      uuid        REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  variables_used              jsonb,
  status                      text        NOT NULL,
  error                       text,
  dry_run                     boolean     NOT NULL DEFAULT false,
  broker_id                   uuid,                                       -- v1: nullable; v1.1 SaaS: NOT NULL
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lr_match_decisions_status_check CHECK (
    status IN ('enrolled', 'manual_review', 'failed', 'dry_run', 'superseded')
  ),
  CONSTRAINT lr_match_decisions_confidence_check CHECK (
    match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)
  )
);

COMMENT ON TABLE lr_match_decisions IS
  'Audit log of every Lead Router routing decision. Idempotency via partial unique index on (buyer_lead_id) WHERE status=enrolled AND dry_run=false.';

-- Idempotency: at most one active enrollment per buyer lead (excludes dry runs)
CREATE UNIQUE INDEX idx_lr_match_decisions_lead_enrolled
  ON lr_match_decisions(buyer_lead_id)
  WHERE status = 'enrolled' AND dry_run = false;

CREATE INDEX idx_lr_match_decisions_lead
  ON lr_match_decisions(buyer_lead_id);

CREATE INDEX idx_lr_match_decisions_recent
  ON lr_match_decisions(created_at DESC);

CREATE INDEX idx_lr_match_decisions_listing
  ON lr_match_decisions(matched_listing_id)
  WHERE matched_listing_id IS NOT NULL;

CREATE INDEX idx_lr_match_decisions_status
  ON lr_match_decisions(status);

-- ----------------------------------------------------------------------------
-- 4. lr_suppressed_emails — Global suppression list
-- ----------------------------------------------------------------------------
-- Pre-send check enforces this. Email stored lowercase to avoid case mismatch.

CREATE TABLE lr_suppressed_emails (
  email           text PRIMARY KEY CHECK (email = lower(email) AND email LIKE '%@%'),
  reason          text,
  source          text        NOT NULL DEFAULT 'manual',
  suppressed_by   uuid,
  broker_id       uuid,                                                   -- v1: nullable; v1.1 SaaS: NOT NULL
  suppressed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lr_suppressed_emails_source_check CHECK (
    source IN ('manual', 'bounce', 'unsubscribe', 'complaint', 'system')
  )
);

COMMENT ON TABLE lr_suppressed_emails IS
  'Lead Router suppression list. Checked before every Gmail send.';

-- ----------------------------------------------------------------------------
-- 5. Row-level security
-- ----------------------------------------------------------------------------
-- v1: RLS enabled with NO policies — anon/authenticated have no access.
-- The Lead Router uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- v1.1 (SaaS): add per-broker_id policies for multi-tenancy.

ALTER TABLE lr_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lr_match_decisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lr_suppressed_emails  ENABLE ROW LEVEL SECURITY;

COMMIT;
