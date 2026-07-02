-- expected_counts: the reconciliation contract. During onboarding/import the
-- client (or operator) records how many of each entity SHOULD exist; a recon
-- query compares against actual counts and surfaces drift. Foundation of the
-- "prove the data is all there" loop.
create table public.expected_counts (
  client_id uuid not null references public.clients(id),
  entity    text not null,              -- e.g. 'projects', 'contacts'
  expected  integer not null,
  as_of     date not null,
  primary key (client_id, entity)
);
