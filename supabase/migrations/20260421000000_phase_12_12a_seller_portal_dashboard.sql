-- =============================================================
-- Phase 12.12a — Seller Portal Dashboard RPC
-- =============================================================
-- Returns a single jsonb payload for the seller progress dashboard:
--   - listing:         listing identity + current stage + days_on_market
--   - engagement:      aggregate buyer counts (total, NDAs signed, qualified,
--                      by_stage)
--   - activity:        most recent 20 activities on the listing + child deals
--   - documents:       listing documents (ordered by confidential_tier)
--
-- Security model:
--   - SECURITY DEFINER so the caller (authenticated seller user) reads
--     through the RPC without holding direct read access to the aggregate
--     source tables.
--   - Authorization check: auth.uid() must resolve to a contact with an
--     ACTIVE deal_access row on this seller_listing with role = 'seller'.
--   - Raises exception if check fails so the client gets a clear error.
--
-- Dependencies:
--   - seller_listings, buyer_engagements, deal_access, activities,
--     deal_documents, contacts
-- =============================================================

create or replace function public.fn_portal_seller_dashboard(
  p_listing_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_contact_id uuid;
  v_has_access boolean;
  v_listing jsonb;
  v_engagement jsonb;
  v_activity jsonb;
  v_documents jsonb;
begin
  -- Resolve auth.uid() to a contact row
  select c.id into v_caller_contact_id
  from public.contacts c
  where c.auth_user_id = auth.uid()
  limit 1;

  if v_caller_contact_id is null then
    raise exception 'portal: caller is not a registered contact';
  end if;

  -- Authorize: seller-role deal_access for this listing
  select exists (
    select 1
    from public.deal_access da
    where da.parent_type = 'seller_listing'
      and da.parent_id = p_listing_id
      and da.contact_id = v_caller_contact_id
      and da.role = 'seller'
      and da.is_active = true
  ) into v_has_access;

  if not v_has_access then
    raise exception 'portal: access denied for listing %', p_listing_id;
  end if;

  -- 1) Listing identity + stage + days-on-market (proxy = created_at)
  select jsonb_build_object(
    'id',                sl.id,
    'listing_name',      sl.name,
    'industry',          sl.industry,
    'asking_price',      sl.asking_price_usd,
    'annual_revenue',    sl.revenue_ttm_usd,
    'ebitda',            sl.ebitda_ttm_usd,
    'sde',               sl.sde_ttm_usd,
    'stage',             sl.stage,
    'days_on_market',    greatest(0, (current_date - sl.created_at::date)),
    'listed_on',         sl.created_at,
    'last_activity_at',  sl.last_activity_at,
    'commission_pct',    sl.commission_pct
  ) into v_listing
  from public.seller_listings sl
  where sl.id = p_listing_id;

  -- 2) Engagement stats across all buyer_engagements linked to this listing
  --    Link model: buyer_engagement's primary_contact has deal_access on the
  --    listing, OR the engagement's custom_fields carries the listing id.
  with be as (
    select distinct be.id, be.stage::text as stage,
           coalesce(da_buyer.nda_signed, false) as nda_signed
    from public.buyer_engagements be
    left join public.deal_access da_buyer
      on da_buyer.parent_type = 'buyer_engagement'
     and da_buyer.parent_id = be.id
     and da_buyer.role = 'buyer'
     and da_buyer.is_active = true
    where exists (
      select 1 from public.deal_access dax
      where dax.parent_type = 'seller_listing'
        and dax.parent_id = p_listing_id
        and dax.contact_id = be.primary_contact_id
        and dax.is_active = true
    )
       or be.custom_fields ->> 'seller_listing_id' = p_listing_id::text
  )
  select jsonb_build_object(
    'total_buyers',     (select count(*) from be),
    'ndas_signed',      (select count(*) from be where nda_signed = true),
    'qualified_buyers', (select count(*) from be where stage = 'qualified'),
    'active_loi',       (select count(*) from be where stage in ('loi_negotiation','under_contract')),
    'in_due_diligence', (select count(*) from be where stage = 'due_diligence'),
    'by_stage',         (
                         select coalesce(jsonb_object_agg(stage, cnt), '{}'::jsonb)
                         from (
                           select stage, count(*) cnt from be
                           where stage is not null
                           group by stage
                         ) s
                        )
  ) into v_engagement;

  -- 3) Recent activity on the listing (20 newest)
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.occurred_at desc), '[]'::jsonb)
    into v_activity
  from (
    select a.id,
           a.kind::text as kind,
           a.subject,
           a.summary,
           a.occurred_at,
           a.from_stage,
           a.to_stage,
           concat_ws(' ', c.first_name, c.last_name) as actor_name
    from public.activities a
    left join public.contacts c on c.id = a.actor_contact_id
    where (a.parent_type = 'seller_listing' and a.parent_id = p_listing_id)
       or (a.secondary_type = 'seller_listing' and a.secondary_id = p_listing_id)
    order by a.occurred_at desc
    limit 20
  ) t;

  -- 4) Documents on the listing, ordered by tier asc then name
  select coalesce(jsonb_agg(row_to_json(d)::jsonb), '[]'::jsonb)
    into v_documents
  from (
    select dd.id,
           dd.document_name,
           dd.document_type,
           dd.confidential_tier::text as confidential_tier,
           dd.storage_path,
           dd.uploaded_at,
           dd.version
    from public.deal_documents dd
    where dd.parent_type = 'seller_listing'
      and dd.parent_id = p_listing_id
      and coalesce(dd.is_active, true) = true
    order by dd.confidential_tier asc nulls last, dd.document_name
  ) d;

  return jsonb_build_object(
    'listing',      v_listing,
    'engagement',   v_engagement,
    'activity',     v_activity,
    'documents',    v_documents,
    'generated_at', now()
  );
end;
$$;

-- Grants: authenticated callers; DEFINER handles row-level authz
revoke all on function public.fn_portal_seller_dashboard(uuid) from public;
grant execute on function public.fn_portal_seller_dashboard(uuid) to authenticated;

comment on function public.fn_portal_seller_dashboard(uuid) is
  'Phase 12.12a — Returns seller-scoped portal dashboard payload (listing, engagement stats, recent activity, documents). Auth via deal_access role=seller.';
