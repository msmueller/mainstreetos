-- =============================================================
-- Phase 12.12c — Document Viewer Polish: telemetry RPC
-- =============================================================
-- Adds seller-side per-document view telemetry, driven by
-- portal_sessions rows already written by the buyer portal.
--
-- Returns, per document:
--   * views / downloads (action counts)
--   * unique_viewers    (distinct contact_ids that viewed)
--   * last_viewed_at    (max created_at across view actions)
--   * last_viewer_contact_id / last_viewer_name
--
-- Authorization: caller must hold an active seller-role
-- deal_access row on (parent_type, parent_id), OR be the
-- broker user (service role bypasses RLS already).
-- =============================================================

-- Supporting index on (document_id, action) for fast rollups
create index if not exists ix_portal_sessions_doc_action
  on public.portal_sessions (document_id, action)
  where document_id is not null;

-- =============================================================
-- fn_portal_doc_telemetry(parent_type, parent_id)
-- =============================================================
create or replace function public.fn_portal_doc_telemetry(
  p_parent_type text,
  p_parent_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_is_seller boolean := false;
  v_result jsonb;
begin
  -- Resolve auth.uid() to contact_id
  select c.id into v_contact_id
  from public.contacts c
  where c.auth_user_id = auth.uid()
  limit 1;

  if v_contact_id is null then
    raise exception 'portal: caller is not a registered contact';
  end if;

  -- Authorize: must have seller-role active deal_access on this parent
  select exists (
    select 1
    from public.deal_access da
    where da.parent_type::text = p_parent_type
      and da.parent_id = p_parent_id
      and da.contact_id = v_contact_id
      and da.role = 'seller'
      and da.is_active = true
  ) into v_is_seller;

  if not v_is_seller then
    raise exception 'portal: caller is not the seller on this deal';
  end if;

  -- Build per-document rollup. Join deal_documents so we return
  -- zeros for docs that have no view rows yet.
  select jsonb_agg(
    jsonb_build_object(
      'document_id',           d.id,
      'document_name',         d.document_name,
      'document_type',         d.document_type,
      'confidential_tier',     d.confidential_tier,
      'views',                 coalesce(tel.views, 0),
      'downloads',             coalesce(tel.downloads, 0),
      'unique_viewers',        coalesce(tel.unique_viewers, 0),
      'last_viewed_at',        tel.last_viewed_at,
      'last_viewer_contact_id', tel.last_viewer_contact_id,
      'last_viewer_name',      tel.last_viewer_name
    )
    order by coalesce(tel.last_viewed_at, d.uploaded_at) desc nulls last
  )
  into v_result
  from public.deal_documents d
  left join lateral (
    select
      count(*) filter (where ps.action = 'view_document')      as views,
      count(*) filter (where ps.action = 'download_document')  as downloads,
      count(distinct ps.contact_id) filter (where ps.action = 'view_document') as unique_viewers,
      max(ps.created_at) filter (where ps.action = 'view_document') as last_viewed_at,
      (
        select ps2.contact_id
        from public.portal_sessions ps2
        where ps2.document_id = d.id
          and ps2.action = 'view_document'
        order by ps2.created_at desc
        limit 1
      ) as last_viewer_contact_id,
      (
        select trim(concat_ws(' ', c2.first_name, c2.last_name))
        from public.portal_sessions ps2
        join public.contacts c2 on c2.id = ps2.contact_id
        where ps2.document_id = d.id
          and ps2.action = 'view_document'
        order by ps2.created_at desc
        limit 1
      ) as last_viewer_name
    from public.portal_sessions ps
    where ps.document_id = d.id
  ) tel on true
  where d.parent_type::text = p_parent_type
    and d.parent_id = p_parent_id
    and d.is_active = true;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function public.fn_portal_doc_telemetry(text, uuid) from public;
grant execute on function public.fn_portal_doc_telemetry(text, uuid) to authenticated;

comment on function public.fn_portal_doc_telemetry(text, uuid) is
  'Phase 12.12c — Seller-scoped per-document view telemetry (views, downloads, unique_viewers, last_viewed_at, last_viewer). Authorizes via active seller-role deal_access.';
