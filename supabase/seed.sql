-- kg-core seed fixture — Ryan-shaped but entirely fake.
-- Deterministic UUIDs (prefix = table family) so tests can reference rows directly:
--   c0.. clients   10.. users     20.. groups    30.. addresses
--   40.. projects  50.. contacts  60.. project_contacts  70.. documents
-- Roles (a0..) and contact_types (b0..) are seeded by migrations.

-- ---------------------------------------------------------------- clients
insert into public.clients (id, name, kind) values
  ('c0000000-0000-4000-8000-000000000001', 'Harborline Property Management', 'property_management'),
  -- Second fixture client exists purely to prove RLS isolation in tests.
  ('c0000000-0000-4000-8000-000000000002', 'Crestline Ventures', 'property_management');

-- ---------------------------------------------------------------- users
insert into public.users (id, client_id, auth0_sub, email, display_name) values
  ('10000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'auth0|harborline-admin',    'reese@harborline.example',  'Reese Calloway'),
  -- Extra Harborline users beyond the "1 admin" brief: needed to exercise
  -- min_role_visibility vs module_visibility independently in tests.
  ('10000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'auth0|harborline-readonly', 'dana@harborline.example',   'Dana Whitfield'),
  ('10000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'auth0|harborline-editor',   'marco@harborline.example',  'Marco Ellison'),
  ('10000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002',
   'auth0|crestline-admin',     'kit@crestline.example',     'Kit Moreno');

-- ---------------------------------------------------------------- role_grants
insert into public.role_grants (id, user_id, role_id, scope_type, scope_id, module_visibility) values
  -- Harborline admin over the whole client.
  ('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'client', 'c0000000-0000-4000-8000-000000000001',
   '{"budgets": true, "contracts": true}'),
  -- read_only with budgets hidden (the module-gating fixture from the brief).
  ('90000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000004', 'client', 'c0000000-0000-4000-8000-000000000001',
   '{"budgets": false, "contracts": true}'),
  -- editor with budgets hidden: rank passes min_role_visibility='editor',
  -- so any block they hit is the module gate alone.
  ('90000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000003', 'client', 'c0000000-0000-4000-8000-000000000001',
   '{"budgets": false, "contracts": true}'),
  -- Crestline admin.
  ('90000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000002', 'client', 'c0000000-0000-4000-8000-000000000002',
   '{"budgets": true, "contracts": true}');

-- ---------------------------------------------------------------- groups
insert into public.groups (id, client_id, name, group_kind, attrs) values
  ('20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Harborview Flats', 'multi_family', '{"units": 24}'),
  ('20000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'Pier 9 Works', 'commercial', '{"floors": 4}');

-- ---------------------------------------------------------------- addresses
-- 7 full addresses + 1 partial (Marsh Road concept: street NULL by design).
insert into public.addresses (id, client_id, raw_input, provider, place_id, street, city, region, postal, country, lat, lng, verified_at) values
  ('30000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '118 Harborview Ln Unit 101, Sausalito CA', 'google_places', 'gplace-hv-101',
   '118 Harborview Ln Unit 101', 'Sausalito', 'CA', '94965', 'US', 37.8591, -122.4853, now()),
  ('30000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '118 Harborview Ln Unit 102, Sausalito CA', 'google_places', 'gplace-hv-102',
   '118 Harborview Ln Unit 102', 'Sausalito', 'CA', '94965', 'US', 37.8591, -122.4853, now()),
  ('30000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '118 Harborview Ln Unit 203, Sausalito CA', 'google_places', 'gplace-hv-203',
   '118 Harborview Ln Unit 203', 'Sausalito', 'CA', '94965', 'US', 37.8592, -122.4853, now()),
  ('30000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   '118 Harborview Ln, Sausalito CA', 'google_places', 'gplace-hv-roof',
   '118 Harborview Ln', 'Sausalito', 'CA', '94965', 'US', 37.8591, -122.4852, now()),
  ('30000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   '9 Pier Rd Suite 400, Sausalito CA', 'google_places', 'gplace-p9-400',
   '9 Pier Rd Suite 400', 'Sausalito', 'CA', '94965', 'US', 37.8570, -122.4901, now()),
  ('30000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   '9 Pier Rd Lobby, Sausalito CA', 'google_places', 'gplace-p9-lobby',
   '9 Pier Rd', 'Sausalito', 'CA', '94965', 'US', 37.8570, -122.4901, now()),
  ('30000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001',
   '9 Pier Rd Roof Plant, Sausalito CA', 'google_places', 'gplace-p9-hvac',
   '9 Pier Rd Roof Plant', 'Sausalito', 'CA', '94965', 'US', 37.8571, -122.4901, now()),
  -- Dream project: city/region only, nothing verified.
  ('30000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001',
   'somewhere on Marsh Road, Corte Madera', null, null,
   null, 'Corte Madera', 'CA', null, 'US', null, null, null),
  -- Crestline (isolation fixture).
  ('30000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000002',
   '77 Ridgecrest Ave, Mill Valley CA', 'google_places', 'gplace-cl-77',
   '77 Ridgecrest Ave', 'Mill Valley', 'CA', '94941', 'US', 37.9060, -122.5450, now());

-- ---------------------------------------------------------------- projects (8 Harborline)
insert into public.projects (id, client_id, group_id, address_id, name, status, is_active_billing, created_by) values
  ('40000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   'Harborview Unit 101', 'active', true,  '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
   'Harborview Unit 102', 'active', true,  '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003',
   'Harborview Unit 203', 'active', false, '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004',
   'Harborview Roof Replacement', 'active', true, '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
   'Pier 9 Suite 400 TI', 'active', true,  '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006',
   'Pier 9 Lobby Refresh', 'active', false, '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000007',
   'Pier 9 HVAC Retrofit', 'active', false, '10000000-0000-4000-8000-000000000001'),
  -- The dream project: no group, partial address.
  ('40000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001',
   null, '30000000-0000-4000-8000-000000000008',
   'Marsh Road concept', 'active', false, '10000000-0000-4000-8000-000000000001');

-- Crestline's single project (isolation fixture; NOT in Harborline counts).
insert into public.projects (id, client_id, group_id, address_id, name, status, created_by) values
  ('40000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000002',
   null, '30000000-0000-4000-8000-000000000101',
   'Ridgecrest Duplex', 'active', '10000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------- contacts (12 Harborline)
insert into public.contacts (id, client_id, kind, display_name, phones, emails, preferred_contact_method, agent_endpoint) values
  ('50000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'org',    'Harborline Holdings LLC',
   '[{"label": "main", "value": "+1-415-555-0100"}]', '[{"label": "main", "value": "office@harborlineholdings.example"}]', 'email', null),
  ('50000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'person', 'Jordan Mears',
   '[{"label": "mobile", "value": "+1-415-555-0101"}]', '[{"label": "personal", "value": "jordan.mears@example.com"}]', 'sms', null),
  ('50000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'person', 'Priya Natarajan',
   '[{"label": "mobile", "value": "+1-415-555-0102"}]', '[{"label": "personal", "value": "priya.n@example.com"}]', 'email', null),
  ('50000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   'person', 'Sam Okafor',
   '[{"label": "mobile", "value": "+1-415-555-0103"}]', '[{"label": "personal", "value": "sam.okafor@example.com"}]', 'phone', null),
  ('50000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   'org',    'Bayline Plumbing Co.',
   '[{"label": "dispatch", "value": "+1-415-555-0104"}]', '[{"label": "dispatch", "value": "jobs@bayline.example"}]', 'phone', null),
  ('50000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   'org',    'GreenSweep Landscaping',
   '[{"label": "main", "value": "+1-415-555-0105"}]', '[]', 'phone', null),
  ('50000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001',
   'person', 'Felix Arroyo',
   '[{"label": "mobile", "value": "+1-415-555-0106"}]', '[]', 'sms', null),
  ('50000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001',
   'person', 'Nina Mears',
   '[{"label": "mobile", "value": "+1-415-555-0107"}]', '[]', 'phone', null),
  ('50000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001',
   'person', 'Theo Grant',
   '[]', '[{"label": "personal", "value": "theo.grant@example.com"}]', 'email', null),
  -- The machine contact: an agent with a callable endpoint.
  ('50000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000001',
   'agent',  'Harborline Ops Agent',
   '[]', '[]', 'agent', 'https://agents.harborline.example/ops'),
  ('50000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-000000000001',
   'org',    'Marin Electric Supply',
   '[{"label": "counter", "value": "+1-415-555-0108"}]', '[{"label": "orders", "value": "orders@marinelectric.example"}]', 'email', null),
  ('50000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-000000000001',
   'person', 'Avery Stone',
   '[{"label": "mobile", "value": "+1-415-555-0109"}]', '[{"label": "personal", "value": "avery.stone@example.com"}]', 'sms', null);

-- Crestline's single contact (isolation fixture).
insert into public.contacts (id, client_id, kind, display_name) values
  ('50000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000002',
   'person', 'Rowan Alcott');

-- ---------------------------------------------------------------- project_contacts
-- Dates are relative to current_date so the time-bounds test never rots.
insert into public.project_contacts (id, client_id, project_id, contact_id, contact_type_id, valid_from, valid_to, status, source, created_by) values
  -- Current lessee, Unit 101 (window straddles today -> effective active).
  ('60000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002',
   'b0000000-0000-4000-8000-000000000008', current_date - 300, current_date + 65, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  -- Current lessee, Unit 102.
  ('60000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003',
   'b0000000-0000-4000-8000-000000000008', current_date - 500, current_date + 230, 'active', 'import',
   '10000000-0000-4000-8000-000000000001'),
  -- PAST lessee, Unit 203: valid_to = last day of LAST MONTH. Stored status stays
  -- 'active' on purpose — effective_status must derive 'inactive' from the dates.
  ('60000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004',
   'b0000000-0000-4000-8000-000000000008',
   (date_trunc('month', current_date) - interval '13 months')::date,
   (date_trunc('month', current_date) - interval '1 day')::date,
   'active', 'import', '10000000-0000-4000-8000-000000000001'),
  -- Occupant, Unit 101 (no window).
  ('60000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000009',
   'b0000000-0000-4000-8000-000000000002', null, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  -- ONE vendor (Bayline Plumbing) spanning THREE projects.
  ('60000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000005',
   'b0000000-0000-4000-8000-000000000003', null, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005',
   'b0000000-0000-4000-8000-000000000003', null, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000005',
   'b0000000-0000-4000-8000-000000000003', null, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  -- Worker on the roof job.
  ('60000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000007',
   'b0000000-0000-4000-8000-000000000005', null, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  -- Emergency contact for Unit 101's lessee.
  ('60000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000008',
   'b0000000-0000-4000-8000-000000000007', null, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  -- The ops agent attached to the Suite 400 TI.
  ('60000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-00000000000a',
   'b0000000-0000-4000-8000-000000000006', null, null, 'active', 'machine',
   '10000000-0000-4000-8000-000000000001'),
  -- Month-to-month occupant, Unit 102 (open-ended window -> active).
  ('60000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-00000000000c',
   'b0000000-0000-4000-8000-000000000009', current_date - 100, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001'),
  -- Owner entity on the dream project.
  ('60000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', null, null, 'active', 'manual',
   '10000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- documents
insert into public.documents (id, client_id, storage_path, doc_type, title, mime, size, uploaded_by, source, min_role_visibility) values
  -- The budgets-marked, role-gated placeholder from the brief.
  ('70000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'harborline/budgets/fy26-harborview.xlsx', 'budgets', 'FY26 Operating Budget — Harborview',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 48213,
   '10000000-0000-4000-8000-000000000001', 'manual', 'editor'),
  -- An ungated document, to prove blocked users are blocked by the GATES,
  -- not by document RLS in general.
  ('70000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'harborline/leases/unit-101-mears.pdf', 'lease', 'Unit 101 Lease — Mears',
   'application/pdf', 812331,
   '10000000-0000-4000-8000-000000000001', 'import', null);

insert into public.document_links (document_id, target_type, target_id) values
  ('70000000-0000-4000-8000-000000000001', 'group',   '20000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000001', 'client',  'c0000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000002', 'project', '40000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- expected_counts
insert into public.expected_counts (client_id, entity, expected, as_of) values
  ('c0000000-0000-4000-8000-000000000001', 'projects', 8,  current_date),
  ('c0000000-0000-4000-8000-000000000001', 'contacts', 12, current_date),
  -- Added for the grid workspace: every tab shows a live reconciliation chip.
  ('c0000000-0000-4000-8000-000000000001', 'groups',   2,  current_date),
  ('c0000000-0000-4000-8000-000000000001', 'users',    3,  current_date);

-- ---------------------------------------------------------------- ledger (80..)
-- Chart of accounts + client cost-code vocabulary + baselined budgets for two
-- projects, one APPROVED change order (moves revised budget), one PENDING
-- change order (founder approves it in the dogfood), and opening expenses.
insert into public.ledger_accounts (id, client_id, code, name, type) values
  ('80000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '1000', 'Operating Cash',    'asset'),
  ('80000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '2000', 'Accounts Payable',  'liability'),
  ('80000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', '4000', 'Rental Revenue',    'revenue'),
  ('80000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '5000', 'Operating Expense', 'expense');

insert into public.ledger_cost_codes (id, client_id, code, label) values
  ('81000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'maintenance', 'Maintenance & repairs'),
  ('81000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'capital',     'Capital improvement'),
  ('81000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'operations',  'Operations'),
  ('81000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'leasing',     'Leasing & turnover');

-- Budgets: Harborview Roof Replacement (the money demo project) + Unit 101.
insert into public.ledger_budget_lines (id, client_id, project_id, cost_code_id, original_amount, baselined_at) values
  ('82000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000002', 120000.00, now()),
  ('82000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000001', 15000.00, now()),
  ('82000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 12000.00, now()),
  ('82000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003', 6000.00, now());

-- CO #1 APPROVED: +$18,000 capital on the roof (revised capital = $138,000).
insert into public.ledger_change_orders (id, client_id, project_id, number, status, description, created_by, approved_by, approved_at) values
  ('83000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000004', 1, 'approved', 'Structural upgrade — approved scope add',
   '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', now());
insert into public.ledger_change_order_lines (change_order_id, cost_code_id, budget_delta) values
  ('83000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 18000.00);

-- CO #2 PENDING: +$9,500 maintenance (the dogfood "change a variable" beat).
insert into public.ledger_change_orders (id, client_id, project_id, number, status, description, created_by) values
  ('83000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000004', 2, 'pending', 'Dry-rot repair discovered at tear-off',
   '10000000-0000-4000-8000-000000000001');
insert into public.ledger_change_order_lines (change_order_id, cost_code_id, budget_delta) values
  ('83000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 9500.00);

-- Opening expenses: balanced entries (expense debit / AP credit).
insert into public.ledger_entries (id, client_id, project_id, source_type, memo, created_by) values
  ('84000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000004', 'invoice', 'Ridgeline Roofing — mobilization deposit',
   '10000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', 'invoice', 'Bayline Plumbing — disposal line snake',
   '10000000-0000-4000-8000-000000000001');
insert into public.ledger_lines (entry_id, account_id, cost_code_id, debit, credit) values
  ('84000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000004',
   '81000000-0000-4000-8000-000000000002', 42500.00, 0),
  ('84000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', null, 0, 42500.00),
  ('84000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000004',
   '81000000-0000-4000-8000-000000000001', 830.00, 0),
  ('84000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', null, 0, 830.00);

-- ---------------------------------------------------------------- events (actor variety)
insert into public.events (client_id, actor_type, actor_id, verb, target_type, target_id, payload, duration_ms) values
  ('c0000000-0000-4000-8000-000000000001', 'user', '10000000-0000-4000-8000-000000000001',
   'project.created', 'project', '40000000-0000-4000-8000-000000000001', '{"name": "Harborview Unit 101"}', null),
  ('c0000000-0000-4000-8000-000000000001', 'user', '10000000-0000-4000-8000-000000000001',
   'document.uploaded', 'document', '70000000-0000-4000-8000-000000000002', '{"doc_type": "lease"}', null),
  ('c0000000-0000-4000-8000-000000000001', 'operator', null,
   'client.provisioned', 'client', 'c0000000-0000-4000-8000-000000000001', '{"plan": "pilot"}', null),
  ('c0000000-0000-4000-8000-000000000001', 'machine', null,
   'agent.sync', 'contact', '50000000-0000-4000-8000-00000000000a', '{"agent": "harborline-ops"}', 412),
  ('c0000000-0000-4000-8000-000000000001', 'machine', null,
   'import.completed', 'client', 'c0000000-0000-4000-8000-000000000001', '{"rows": 20, "source": "csv"}', 90211);
