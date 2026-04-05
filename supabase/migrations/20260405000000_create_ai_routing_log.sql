create table ai_routing_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  broker_id uuid not null references auth.users(id),
  task text not null,
  tier text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  deal_size_usd numeric,
  reason text
);

-- Index for broker lookups
create index ai_routing_log_broker_id_idx on ai_routing_log(broker_id);

-- Enable RLS
alter table ai_routing_log enable row level security;

-- Brokers can only read their own rows
create policy "Brokers can read own routing logs"
  on ai_routing_log for select
  to authenticated
  using (broker_id = auth.uid());

-- Service role can insert (agents write via service key)
create policy "Service role can insert routing logs"
  on ai_routing_log for insert
  to service_role
  with check (true);
