-- =====================================================================
-- Drop Deprecated Contact Columns
-- =====================================================================
-- Follow-up to 20260415000000_crm_separation_leads_projects.sql
--
-- These 14 columns were marked DEPRECATED on 2026-04-15 after the CRM
-- separation migration. Workflow/qualification data now lives in
-- public.leads and public.consulting_projects. The sync task has been
-- verified routing only to those tables; contacts is now directory-only.
--
-- Safety: each DROP uses IF EXISTS so the migration is idempotent and
-- won't fail if a column was already removed manually.
-- =====================================================================

ALTER TABLE public.contacts DROP COLUMN IF EXISTS business_experience;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS buyer_profile_url;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS buyer_type;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS completed_buyer_profile;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS completed_loi;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS completed_nda;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS consider_franchise;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS date_received;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS inquiry_message;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS lead_status_update;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS listing_name_match;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS listing_number_match;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS next_action;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS read_flag;
