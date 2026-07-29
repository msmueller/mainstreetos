-- Phase 12.12-C v2 — add engagement Data Room to fn_portal_project_dashboard.
-- Applied to prod 2026-07-29 via MCP (migration: phase_12_12c_project_dashboard_dataroom).
-- Room is returned only when the contact holds an active ('granted') data_room_grant.
-- Repo copy for migration-history parity; see the applied version in
-- supabase_migrations.schema_migrations for the authoritative SQL.
CREATE OR REPLACE FUNCTION public.fn_portal_project_dashboard(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contact uuid; v_ok boolean; v_project jsonb; v_deliverables jsonb; v_broker jsonb; v_data_room jsonb;
BEGIN
  SELECT c.id INTO v_contact FROM contacts c WHERE c.auth_user_id = auth.uid();
  IF v_contact IS NULL THEN RAISE EXCEPTION 'No contact bound to this account'; END IF;
  SELECT EXISTS (SELECT 1 FROM project_access pa
     WHERE pa.project_id = p_project_id AND pa.contact_id = v_contact AND pa.is_active = true) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Access denied for this project'; END IF;

  SELECT to_jsonb(x) INTO v_project FROM (
    SELECT p.id, p.project_name, p.service_type, p.scope_description, p.scope_statement,
           p.project_status, p.completion_percent, p.date_started, p.due_date,
           p.kickoff_at, p.target_completion_at, p.date_completed,
           p.engagement_type, p.billing_model, p.payment_terms, p.created_at
      FROM projects p WHERE p.id = p_project_id) x;

  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.due_date ASC NULLS LAST, d.created_at ASC), '[]'::jsonb)
    INTO v_deliverables
    FROM (SELECT pd.id, pd.deliverable_name, pd.deliverable_type, pd.description, pd.status,
             pd.due_date, pd.date_completed, pd.date_delivered, pd.external_url,
             (pd.storage_path IS NOT NULL) AS has_file, pd.storage_path, pd.created_at
        FROM project_deliverables pd
       WHERE pd.project_id = p_project_id AND pd.visible_to_client = true) d;

  SELECT jsonb_build_object('name', u.full_name, 'company', u.company_name)
    INTO v_broker
    FROM projects p LEFT JOIN users u ON u.id = p.broker_id WHERE p.id = p_project_id;

  SELECT jsonb_build_object(
           'name', d.name,
           'drive_root_url', d.drive_root_url,
           'folders', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                          'id', f2.id, 'name', f2.name,
                          'url', 'https://drive.google.com/drive/folders/' || f2.drive_folder_id
                        ) ORDER BY f2.sort_order ASC), '[]'::jsonb)
                         FROM data_room_folders f2
                        WHERE f2.data_room_id = d.id AND f2.is_active = true))
    INTO v_data_room
    FROM data_rooms d
   WHERE d.parent_type = 'project' AND d.parent_id = p_project_id AND d.is_active = true
     AND EXISTS (SELECT 1 FROM data_room_grants g
                  WHERE g.data_room_id = d.id AND g.contact_id = v_contact AND g.status = 'granted')
   LIMIT 1;

  INSERT INTO portal_sessions (contact_id, deal_id, action, portal)
  VALUES (v_contact, p_project_id, 'view_project', 'cp');

  RETURN jsonb_build_object('project', v_project, 'deliverables', v_deliverables,
    'broker', v_broker, 'data_room', v_data_room, 'generated_at', now());
END; $$;
