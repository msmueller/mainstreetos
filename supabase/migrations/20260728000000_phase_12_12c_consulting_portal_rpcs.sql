-- ============================================================
-- Phase 12.12-C — Consulting Client Portal RPCs
-- Third portal surface: PROJECTS persona (Roadmap v4.0).
-- Auth pattern identical to fn_portal_seller_dashboard:
--   auth.uid() -> contacts.auth_user_id -> active project_access row.
-- Grants follow the 2026-07-28 hardening: authenticated + service_role
-- only; no anon, no PUBLIC.
-- ============================================================

-- Projects the signed-in contact can access (persona resolution)
CREATE OR REPLACE FUNCTION public.fn_portal_list_my_projects()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_out jsonb;
BEGIN
  SELECT c.id INTO v_contact FROM contacts c WHERE c.auth_user_id = auth.uid();
  IF v_contact IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'project_id', p.id,
           'project_name', p.project_name,
           'project_status', p.project_status,
           'service_type', p.service_type,
           'granted_at', pa.granted_at
         ) ORDER BY pa.granted_at DESC), '[]'::jsonb)
    INTO v_out
    FROM project_access pa
    JOIN projects p ON p.id = pa.project_id
   WHERE pa.contact_id = v_contact
     AND pa.is_active = true;

  RETURN v_out;
END;
$$;

-- Full dashboard payload for one project
CREATE OR REPLACE FUNCTION public.fn_portal_project_dashboard(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_ok boolean;
  v_project jsonb;
  v_deliverables jsonb;
  v_broker jsonb;
BEGIN
  SELECT c.id INTO v_contact FROM contacts c WHERE c.auth_user_id = auth.uid();
  IF v_contact IS NULL THEN
    RAISE EXCEPTION 'No contact bound to this account';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM project_access pa
     WHERE pa.project_id = p_project_id
       AND pa.contact_id = v_contact
       AND pa.is_active = true
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Access denied for this project';
  END IF;

  SELECT to_jsonb(x) INTO v_project FROM (
    SELECT p.id, p.project_name, p.service_type, p.scope_description, p.scope_statement,
           p.project_status, p.completion_percent, p.date_started, p.due_date,
           p.kickoff_at, p.target_completion_at, p.date_completed,
           p.engagement_type, p.billing_model, p.payment_terms, p.created_at
      FROM projects p WHERE p.id = p_project_id
  ) x;

  -- Client-visible deliverables only: release-by-deliverable control
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.due_date ASC NULLS LAST, d.created_at ASC), '[]'::jsonb)
    INTO v_deliverables
    FROM (
      SELECT pd.id, pd.deliverable_name, pd.deliverable_type, pd.description, pd.status,
             pd.due_date, pd.date_completed, pd.date_delivered, pd.external_url,
             (pd.storage_path IS NOT NULL) AS has_file, pd.storage_path, pd.created_at
        FROM project_deliverables pd
       WHERE pd.project_id = p_project_id
         AND pd.visible_to_client = true
    ) d;

  SELECT jsonb_build_object('name', u.full_name, 'company', u.company_name)
    INTO v_broker
    FROM projects p LEFT JOIN users u ON u.id = p.broker_id
   WHERE p.id = p_project_id;

  -- Engagement telemetry (portal='cp' marks consulting-portal events)
  INSERT INTO portal_sessions (contact_id, deal_id, action, portal)
  VALUES (v_contact, p_project_id, 'view_project', 'cp');

  RETURN jsonb_build_object(
    'project', v_project,
    'deliverables', v_deliverables,
    'broker', v_broker,
    'generated_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_portal_list_my_projects() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_portal_list_my_projects() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_portal_project_dashboard(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_portal_project_dashboard(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_portal_list_my_projects() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_portal_project_dashboard(uuid) TO authenticated, service_role;
