-- =============================================================
-- Phase 12.12b — Buyer Click-Accept NDA + Deal-Room Flow
-- =============================================================
-- Adds in-portal click-accept NDA flow. Reuses existing
-- nda_tracking table + on_nda_signed trigger chain, which already:
--   * advances buyer_stage from inquiry -> nda_executed
--   * flips deal_access.nda_signed + nda_signed_date
--   * routes buyer into CIM portal, bumps max_tier to level_2
--
-- This migration adds:
--   1. nda_templates — versioned click-accept NDA text
--   2. nda_tracking  — 6 click-accept audit columns
--   3. fn_portal_accept_nda(p_parent_type, p_parent_id, p_typed_name,
--                           p_user_agent, p_client_ip) — buyer writes audit
--   4. fn_portal_nda_status(p_parent_type, p_parent_id) — buyer reads status
--
-- Dependencies: pgcrypto (sha256 via digest())
-- =============================================================

-- ---------- 1) nda_templates -----------------------------------
create table if not exists public.nda_templates (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  name text not null,
  body_markdown text not null,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.contacts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ix_nda_templates_active_version
  on public.nda_templates (version) where is_active;

create index if not exists ix_nda_templates_active
  on public.nda_templates (is_active, effective_from desc);

comment on table public.nda_templates is
  'Phase 12.12b — versioned NDA click-accept templates. Body hash is stored per acceptance for tamper-evidence.';

-- Seed the v1 CRE Resources NDA (markdown)
insert into public.nda_templates (version, name, body_markdown, is_active)
select
  'v1.0',
  'CRE Resources, LLC Standard Buyer Confidentiality Agreement',
  $md$## CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT

This Confidentiality and Non-Disclosure Agreement ("Agreement") is entered into between **CRE Resources, LLC** ("Broker"), acting as agent for its seller-clients, and the undersigned prospective purchaser ("Recipient").

**1. Confidential Information.** The Recipient acknowledges that in connection with the evaluation of a possible business acquisition transaction, Broker may disclose certain Confidential Information to Recipient including, without limitation, the identity of the seller, financial statements, customer lists, vendor relationships, operating data, trade secrets, intellectual property, and any marketing materials provided through the MainStreetOS platform.

**2. Non-Disclosure.** Recipient agrees (i) to hold Confidential Information in strict confidence; (ii) not to disclose it to any third party without prior written consent of Broker, except to Recipient's own professional advisors who are bound by equivalent duties of confidentiality; (iii) not to use the Confidential Information for any purpose other than evaluating the proposed transaction.

**3. Non-Circumvention.** Recipient will not, directly or indirectly, contact the seller, its employees, vendors, landlord, customers or other constituents for the purpose of circumventing the Broker's role in this transaction for a period of twenty-four (24) months from the date of this Agreement.

**4. No License; No Warranty.** No license or warranty, express or implied, is granted with respect to the Confidential Information, and Broker and its seller-clients make no representations or warranties as to accuracy, completeness, or fitness for any purpose.

**5. Return or Destruction.** Upon written request by Broker, Recipient will promptly return or destroy all Confidential Information in its possession or control.

**6. Remedies.** Recipient acknowledges that monetary damages alone may be insufficient and that Broker and its seller-clients are entitled to seek equitable relief, including injunctive relief, to enforce this Agreement.

**7. Governing Law.** This Agreement is governed by the laws of the State of New Jersey, without regard to conflicts-of-law principles.

**8. Term.** The obligations herein shall survive for five (5) years from the date of acceptance.

**9. Electronic Acceptance.** By clicking "I Agree", typing your full legal name, and submitting this Agreement, Recipient consents to enter into this Agreement electronically and acknowledges that such acceptance constitutes a legally binding signature under applicable law (E-SIGN and UETA).$md$,
  true
where not exists (
  select 1 from public.nda_templates where version = 'v1.0'
);

-- ---------- 2) nda_tracking — click-accept audit columns ------
alter table public.nda_tracking
  add column if not exists acceptance_method text
    check (acceptance_method in ('portal_click','docusign','manual','email_reply'))
    default null,
  add column if not exists acceptance_ip inet,
  add column if not exists acceptance_user_agent text,
  add column if not exists acceptance_text_hash text,
  add column if not exists acceptance_typed_name text,
  add column if not exists template_id uuid references public.nda_templates(id);

comment on column public.nda_tracking.acceptance_method is
  'Phase 12.12b: portal_click | docusign | manual | email_reply';
comment on column public.nda_tracking.acceptance_text_hash is
  'SHA256 of the NDA body shown to the acceptor at click time — tamper-evidence.';

-- ---------- 3) fn_portal_nda_status ---------------------------
create or replace function public.fn_portal_nda_status(
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
  v_access record;
  v_latest_nda record;
  v_template record;
begin
  -- Resolve auth.uid() to contact
  select c.id into v_contact_id
  from public.contacts c
  where c.auth_user_id = auth.uid()
  limit 1;

  if v_contact_id is null then
    raise exception 'portal: caller is not a registered contact';
  end if;

  -- Find the buyer's deal_access row
  select * into v_access
  from public.deal_access da
  where da.parent_type::text = p_parent_type
    and da.parent_id = p_parent_id
    and da.contact_id = v_contact_id
    and da.is_active = true
  order by da.created_at desc
  limit 1;

  if v_access is null then
    raise exception 'portal: no active access for caller on this deal';
  end if;

  -- Latest NDA record on this deal for this contact
  select * into v_latest_nda
  from public.nda_tracking nt
  where nt.deal_id = v_access.deal_id
    and nt.contact_id = v_contact_id
  order by coalesce(nt.signed_at, nt.created_at) desc
  limit 1;

  -- Currently-active template
  select * into v_template
  from public.nda_templates t
  where t.is_active = true
    and (t.effective_until is null or t.effective_until > now())
  order by t.effective_from desc
  limit 1;

  return jsonb_build_object(
    'required',              (coalesce(v_access.nda_signed, false) = false),
    'accepted',              coalesce(v_access.nda_signed, false),
    'accepted_at',           v_access.nda_signed_date,
    'acceptance_method',     v_latest_nda.acceptance_method,
    'current_tier',          v_access.max_tier,
    'current_stage',         v_access.current_stage,
    'template', jsonb_build_object(
      'id',             v_template.id,
      'version',        v_template.version,
      'name',           v_template.name,
      'body_markdown',  v_template.body_markdown,
      'effective_from', v_template.effective_from
    )
  );
end;
$$;

revoke all on function public.fn_portal_nda_status(text, uuid) from public;
grant execute on function public.fn_portal_nda_status(text, uuid) to authenticated;

comment on function public.fn_portal_nda_status(text, uuid) is
  'Phase 12.12b — Returns buyer-scoped NDA status for a deal: required?, accepted?, active template body, current tier/stage. Auth via deal_access + auth.uid().';

-- ---------- 4) fn_portal_accept_nda ---------------------------
create or replace function public.fn_portal_accept_nda(
  p_parent_type text,
  p_parent_id uuid,
  p_typed_name text,
  p_user_agent text default null,
  p_client_ip text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_access record;
  v_template record;
  v_hash text;
  v_nda_id uuid;
  v_signed_at timestamptz := now();
  v_ip inet;
begin
  -- Validate typed name
  if p_typed_name is null or length(trim(p_typed_name)) < 2 then
    raise exception 'nda: typed name is required';
  end if;

  -- Resolve auth.uid() to contact
  select c.id into v_contact_id
  from public.contacts c
  where c.auth_user_id = auth.uid()
  limit 1;

  if v_contact_id is null then
    raise exception 'portal: caller is not a registered contact';
  end if;

  -- Authorize: active deal_access on this parent
  select * into v_access
  from public.deal_access da
  where da.parent_type::text = p_parent_type
    and da.parent_id = p_parent_id
    and da.contact_id = v_contact_id
    and da.is_active = true
  order by da.created_at desc
  limit 1;

  if v_access is null then
    raise exception 'nda: no active access for caller on this deal';
  end if;

  -- Guard: already signed — return current status, do NOT re-insert
  -- (prevents trigger re-running advance_buyer_stage and moving a
  --  later-stage buyer backward to nda_executed)
  if coalesce(v_access.nda_signed, false) = true then
    return jsonb_build_object(
      'status',       'already_accepted',
      'accepted_at',  v_access.nda_signed_date,
      'current_tier', v_access.max_tier,
      'current_stage', v_access.current_stage
    );
  end if;

  -- Fetch currently-active template
  select * into v_template
  from public.nda_templates t
  where t.is_active = true
    and (t.effective_until is null or t.effective_until > now())
  order by t.effective_from desc
  limit 1;

  if v_template is null then
    raise exception 'nda: no active NDA template';
  end if;

  -- Compute sha256 hex hash of the exact template body shown
  v_hash := encode(digest(v_template.body_markdown, 'sha256'), 'hex');

  -- Parse IP (be permissive — bad string becomes null)
  begin
    v_ip := nullif(p_client_ip, '')::inet;
  exception when others then
    v_ip := null;
  end;

  -- Insert new nda_tracking row with nda_status='signed'.
  -- Trigger on_nda_signed fires and:
  --   * calls advance_buyer_stage(deal_id, contact_id, 'nda_executed')
  --   * sets deal_access.nda_signed = true, nda_signed_date = signed_at
  --   * writes portal_sessions log row
  insert into public.nda_tracking (
    deal_id,
    contact_id,
    parent_type,
    parent_id,
    nda_status,
    sent_at,
    signed_at,
    template_id,
    acceptance_method,
    acceptance_ip,
    acceptance_user_agent,
    acceptance_text_hash,
    acceptance_typed_name,
    notes
  ) values (
    v_access.deal_id,
    v_contact_id,
    v_access.parent_type,
    v_access.parent_id,
    'signed',
    v_signed_at,
    v_signed_at,
    v_template.id,
    'portal_click',
    v_ip,
    p_user_agent,
    v_hash,
    trim(p_typed_name),
    'Accepted via MainStreetOS portal click-through'
  ) returning id into v_nda_id;

  -- Additionally log an activity row for the feed (trigger writes portal_sessions,
  -- but activities is the canonical source the seller dashboard and timelines use).
  insert into public.activities (
    kind,
    occurred_at,
    parent_type,
    parent_id,
    secondary_type,
    secondary_id,
    subject,
    summary,
    source_table,
    source_id,
    actor_contact_id,
    from_stage,
    to_stage
  ) values (
    'nda_signed'::activity_kind,
    v_signed_at,
    v_access.parent_type,
    v_access.parent_id,
    null,
    null,
    'NDA accepted via portal',
    format('%s accepted the %s NDA via portal click-through', trim(p_typed_name), v_template.version),
    'nda_tracking',
    v_nda_id,
    v_contact_id,
    v_access.current_stage::text,
    'nda_executed'
  );

  -- Return fresh state so the client can unlock UI
  return jsonb_build_object(
    'status',         'accepted',
    'acceptance_id',  v_nda_id,
    'accepted_at',    v_signed_at,
    'template_version', v_template.version,
    'text_hash',      v_hash,
    'unlocked_tier',  'level_2_nda_required'
  );
end;
$$;

revoke all on function public.fn_portal_accept_nda(text, uuid, text, text, text) from public;
grant execute on function public.fn_portal_accept_nda(text, uuid, text, text, text) to authenticated;

comment on function public.fn_portal_accept_nda(text, uuid, text, text, text) is
  'Phase 12.12b — Buyer click-accept NDA flow. Writes nda_tracking row (trigger cascades to deal_access + stage advance) and activities log. Tamper-evident via sha256 of template body.';
