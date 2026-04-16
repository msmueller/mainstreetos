-- =====================================================================
-- CRM Separation Migration: LEADS + CONSULTING_PROJECTS tables
-- =====================================================================
-- Purpose: Correct the CRM architecture to match Notion's canonical design:
--   CONTACTS     = slim identity directory (no workflow/qualification)
--   LEADS        = single source of truth for Deal workflow + qualification
--   PROJECTS     = single source of truth for Consulting workflow
-- All workflow tables relate back to CONTACTS via contact_id FK.
--
-- Parts:
--   1. CREATE public.leads
--   2. CREATE public.consulting_projects
--   3. Deprecate workflow columns on public.contacts (mark, do not drop yet)
-- =====================================================================

-- ---------------------------------------------------------------------
-- PART 1: public.leads  (Deal workflow + buyer qualification)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.leads (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id             TEXT UNIQUE,

  -- Relations
  contact_id                 UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  listing_id                 UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  deal_id                    UUID REFERENCES public.deals(id)    ON DELETE SET NULL,

  -- Lead identity / pipeline
  lead_name                  TEXT,
  status_update              TEXT,                 -- drives deal_access tiering
  buyer_type                 TEXT,
  lead_source                TEXT,
  date_received              DATE,
  inquiry_message            TEXT,
  next_action                TEXT,
  read_flag                  BOOLEAN DEFAULT FALSE,
  buyer_profile_url          TEXT,

  -- Gate flags
  completed_nda              BOOLEAN DEFAULT FALSE,
  completed_loi              BOOLEAN DEFAULT FALSE,
  completed_buyer_profile    BOOLEAN DEFAULT FALSE,

  -- Listing text match fields (used during sync before FK resolution)
  listing_number_match       TEXT,
  listing_name_match         TEXT,

  -- Buyer Profile / qualification (BP_*)
  bp_us_citizen              BOOLEAN,
  bp_current_income          NUMERIC,
  bp_liquid_cash             NUMERIC,
  bp_total_assets            NUMERIC,
  bp_total_liabilities       NUMERIC,
  bp_owned_re_value          NUMERIC,
  bp_lines_on_re             NUMERIC,
  bp_other_assets            NUMERIC,
  bp_down_payment_available  NUMERIC,
  bp_investment_funds        NUMERIC,
  bp_available_funds         NUMERIC,
  bp_budget_min              NUMERIC,
  bp_budget_max              NUMERIC,
  bp_credit_score            INTEGER,

  -- Qualification narrative
  business_partner_involved  BOOLEAN,
  partner_names              TEXT,
  consider_franchise         BOOLEAN,
  employment_status          TEXT,
  prior_business_ownership   BOOLEAN,
  business_experience        TEXT,
  industries_of_interest     TEXT[],
  location_preference        TEXT,
  time_frame                 TEXT,
  time_frame_notes           TEXT,
  financing_status           TEXT,
  acquisition_reason         TEXT,

  -- Housekeeping
  notes                      TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_contact_id   ON public.leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_listing_id   ON public.leads(listing_id);
CREATE INDEX IF NOT EXISTS idx_leads_deal_id      ON public.leads(deal_id);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON public.leads(status_update);
CREATE INDEX IF NOT EXISTS idx_leads_date_rcvd    ON public.leads(date_received);

COMMENT ON TABLE  public.leads IS 'Deal workflow: buyer inquiries, qualification, BP data. Single source of truth for lead lifecycle.';
COMMENT ON COLUMN public.leads.status_update IS 'Notion LEADS.Status Update — drives deal_access tier assignment.';

-- ---------------------------------------------------------------------
-- PART 2: public.consulting_projects  (Consulting workflow)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.consulting_projects (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id             TEXT UNIQUE,

  -- Relations
  contact_id                 UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id                    UUID REFERENCES public.deals(id)    ON DELETE SET NULL,

  -- Core
  project_name               TEXT NOT NULL,
  pipeline_stage             TEXT,     -- 10-stage: Inquiry → Complete
  client_status              TEXT,
  client_type                TEXT,
  contact_type               TEXT,
  activity                   TEXT,
  status                     TEXT,
  priority                   TEXT,

  -- Team / location
  project_lead               TEXT[],
  affiliated_member          TEXT,
  lead_member                TEXT,
  project_location           TEXT,

  -- Scope
  project_type               TEXT[],
  role                       TEXT[],
  scope_of_work              TEXT[],
  industry                   TEXT[],
  source                     TEXT,

  -- Value
  value                      NUMERIC,
  value_description          TEXT,
  value_type                 TEXT[],

  -- Dates
  date_engaged               DATE,
  date_completed             DATE,
  dates                      DATERANGE,

  -- External refs
  daylite_project_id         TEXT,
  proposal_url               TEXT,
  cim_url                    TEXT,
  appraisal_url              TEXT,
  om_url                     TEXT,

  -- Narrative
  ai_sow_summary             TEXT,
  client_access              TEXT,
  notes                      TEXT,

  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cproj_contact_id     ON public.consulting_projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_cproj_deal_id        ON public.consulting_projects(deal_id);
CREATE INDEX IF NOT EXISTS idx_cproj_pipeline_stage ON public.consulting_projects(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_cproj_status         ON public.consulting_projects(status);

COMMENT ON TABLE public.consulting_projects IS 'Consulting workflow (Notion PROJECTS): SOW-driven engagements, 10-stage pipeline.';

-- ---------------------------------------------------------------------
-- PART 3: Deprecate workflow columns on public.contacts
-- ---------------------------------------------------------------------
-- Strategy: mark columns deprecated via COMMENT, do NOT drop yet.
-- After sync is cut over and data verified in leads/consulting_projects,
-- a follow-up migration will DROP these columns.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  col TEXT;
  deprecated_cols TEXT[] := ARRAY[
    -- BP duplicates
    'bp_us_citizen','bp_current_income','bp_liquid_cash','bp_total_assets',
    'bp_total_liabilities','bp_owned_re_value','bp_lines_on_re','bp_other_assets',
    'bp_down_payment_available','bp_investment_funds','bp_available_funds',
    'bp_budget_min','bp_budget_max','bp_credit_score',
    -- Qualification residue
    'business_partner_involved','consider_franchise','employment_status',
    'prior_business_ownership','business_experience','industries_of_interest',
    'location_preference','time_frame','time_frame_notes','partner_names',
    'financing_status','acquisition_reason',
    -- Lead pipeline residue
    'lead_status','lead_state','lead_type','lead_owner','legacy_lead_id',
    'legacy_lead_page_url','imported_from_leads','merge_notes',
    'listing_number','listing_title','listing_number_match','listing_name_match',
    'lead_status_update',
    -- Workflow state residue
    'completed_nda','completed_loi','completed_buyer_profile',
    'buyer_type','date_received','inquiry_message','next_action',
    'read_flag','buyer_profile_url',
    -- Consulting state residue
    'client_status','client_type','client_since','scope_of_work','action',
    'contact_lifecycle'
  ];
BEGIN
  FOREACH col IN ARRAY deprecated_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'contacts'
        AND column_name  = col
    ) THEN
      EXECUTE format(
        'COMMENT ON COLUMN public.contacts.%I IS %L',
        col,
        'DEPRECATED 2026-04-15 — migrated to leads/consulting_projects. Do not write. Slated for DROP in follow-up migration.'
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.contacts IS 'Slim identity directory. Workflow fields live in leads (deal) and consulting_projects (consulting). Do not add workflow/qualification columns here.';
