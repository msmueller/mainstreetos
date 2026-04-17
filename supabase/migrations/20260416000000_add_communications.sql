-- Communications / Activity Log
-- Tracks all communication history per contact: emails, phone calls, notes, texts
-- Supports manual entry + future Gmail API integration

create table if not exists public.communications (
  id            uuid primary key default gen_random_uuid(),
  broker_id     uuid not null references auth.users(id) on delete cascade,
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete set null,

  -- Type: email, phone, note, text
  comm_type     text not null check (comm_type in ('email', 'phone', 'note', 'text')),

  -- Direction: inbound (from contact) or outbound (from broker)
  direction     text check (direction in ('inbound', 'outbound')),

  -- Content
  subject       text,                          -- email subject or call/text topic
  body          text,                          -- email body, call notes, note content, text content
  summary       text,                          -- AI-generated or manual one-liner

  -- Email-specific fields (for Gmail integration)
  gmail_message_id   text unique,              -- Gmail API message ID (dedup key)
  gmail_thread_id    text,                     -- Gmail thread ID for threading
  from_address       text,                     -- sender email
  to_addresses       text[],                   -- recipient emails
  cc_addresses       text[],                   -- CC emails

  -- Phone/text-specific
  phone_number       text,                     -- phone number involved
  duration_minutes   integer,                  -- call duration

  -- Metadata
  occurred_at   timestamptz not null default now(),  -- when the communication happened
  logged_by     text not null default 'manual',      -- 'manual', 'gmail_sync', 'bbs_scrape'
  is_pinned     boolean not null default false,       -- pin important entries

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes for fast lookups
create index idx_communications_contact_id on public.communications(contact_id);
create index idx_communications_broker_id on public.communications(broker_id);
create index idx_communications_deal_id on public.communications(deal_id);
create index idx_communications_occurred_at on public.communications(occurred_at desc);
create index idx_communications_comm_type on public.communications(comm_type);
create index idx_communications_gmail_thread on public.communications(gmail_thread_id);

-- RLS: brokers see only their own communications
alter table public.communications enable row level security;

create policy "Brokers can read own communications"
  on public.communications for select
  using (broker_id = auth.uid());

create policy "Brokers can insert own communications"
  on public.communications for insert
  with check (broker_id = auth.uid());

create policy "Brokers can update own communications"
  on public.communications for update
  using (broker_id = auth.uid());

create policy "Brokers can delete own communications"
  on public.communications for delete
  using (broker_id = auth.uid());

-- Auto-update updated_at
create or replace function public.update_communications_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_communications_updated_at
  before update on public.communications
  for each row execute function public.update_communications_updated_at();
