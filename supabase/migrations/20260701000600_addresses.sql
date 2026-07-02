-- addresses: normalized postal addresses, provider-agnostic (Google Places today).
-- raw_input preserves what the user typed; normalized holds the full provider payload.
-- street is nullable on purpose: "dream projects" may only know a city/region.
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  raw_input   text,
  normalized  jsonb,
  provider    text,                     -- e.g. 'google_places'
  place_id    text,                     -- provider's stable id, when verified
  street      text,                     -- NULL allowed: concept/dream addresses
  city        text,
  region      text,
  postal      text,
  country     text,
  lat         numeric,
  lng         numeric,
  verified_at timestamptz
);

create index addresses_client_id_idx on public.addresses (client_id);

-- One verified place per client: dedupe on the provider place_id when present.
create unique index addresses_client_place_uidx
  on public.addresses (client_id, place_id)
  where place_id is not null;
