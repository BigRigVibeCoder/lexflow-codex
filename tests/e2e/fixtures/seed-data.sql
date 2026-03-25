-- LexFlow E2E Realistic Test Data (v2 — plain SQL, no PL/pgSQL)
-- Run: cat seed-data.sql | docker exec -i lexflow-postgres psql -U lexflow -d lexflow_web

-- ============================================================
-- CLIENTS (5)
-- ============================================================
INSERT INTO clients (id, name, email, phone, address, notes, created_by)
SELECT
  'a1111111-1111-1111-1111-111111111111'::uuid,
  'Maria Martinez', 'mmartinez@email.com', '(555) 234-5678',
  '1420 Oak Street, Suite 200, Austin, TX 78701',
  'Personal injury client. Referred by Dr. Williams at Austin Orthopedics.',
  id FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, name, email, phone, address, notes, created_by)
SELECT
  'a2222222-2222-2222-2222-222222222222'::uuid,
  'David Chen', 'dchen@techstartup.io', '(555) 345-6789',
  '8800 Research Blvd, Austin, TX 78758',
  'Tech startup founder. Business litigation and contract disputes.',
  id FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, name, email, phone, address, notes, created_by)
SELECT
  'a3333333-3333-3333-3333-333333333333'::uuid,
  'Sarah Williams', 'swilliams@gmail.com', '(555) 456-7890',
  '3200 Exposition Blvd, Apt 14B, Austin, TX 78703',
  'Family law client. Custody and divorce proceedings.',
  id FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, name, email, phone, address, notes, created_by)
SELECT
  'a4444444-4444-4444-4444-444444444444'::uuid,
  'Patrick O Connor', 'poconnor@oceanview.com', '(555) 567-8901',
  '15 Harbor Drive, Galveston, TX 77550',
  'Estate planning client. Complex trust structures. Multiple properties.',
  id FROM users WHERE email = 'admin@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, name, email, phone, address, notes, created_by)
SELECT
  'a5555555-5555-5555-5555-555555555555'::uuid,
  'Priya Patel', 'ppatel@patelmedical.com', '(555) 678-9012',
  '6700 Medical Parkway, Suite 310, Austin, TX 78745',
  'Medical practice. Employment and regulatory compliance matters.',
  id FROM users WHERE email = 'admin@lexflow.test'
ON CONFLICT DO NOTHING;

-- ============================================================
-- MATTERS (8)
-- ============================================================
INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b1111111-1111-1111-1111-111111111111'::uuid,
  'Martinez v. Rideshare Corp',
  'Personal injury claim arising from rideshare accident on 2024-11-15. Client sustained back injuries. Police report filed.',
  'active', 'a1111111-1111-1111-1111-111111111111'::uuid, id, '2026-11-15'
FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b2222222-2222-2222-2222-222222222222'::uuid,
  'Martinez - Slip and Fall (HEB Grocery)',
  'Premises liability. Client slipped on wet floor at HEB on Lamar Blvd. Surveillance footage requested.',
  'active', 'a1111111-1111-1111-1111-111111111111'::uuid, id, '2027-01-20'
FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b3333333-3333-3333-3333-333333333333'::uuid,
  'Williams - Custody Modification',
  'Modification of existing custody order. Client seeking primary custody. Mediation scheduled for April 2026.',
  'active', 'a3333333-3333-3333-3333-333333333333'::uuid, id, NULL
FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b4444444-4444-4444-4444-444444444444'::uuid,
  'Chen v. Former CTO - Trade Secrets',
  'Trade secret misappropriation claim. Former CTO took proprietary code to competitor. TRO filed and granted.',
  'active', 'a2222222-2222-2222-2222-222222222222'::uuid, id, '2027-03-01'
FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b5555555-5555-5555-5555-555555555555'::uuid,
  'O Connor Estate Plan',
  'Comprehensive estate plan: revocable living trust, pour-over will, healthcare directive, financial POA. 3 properties.',
  'active', 'a4444444-4444-4444-4444-444444444444'::uuid, id, NULL
FROM users WHERE email = 'admin@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b6666666-6666-6666-6666-666666666666'::uuid,
  'Patel Medical - DUI Defense (Employee)',
  'Criminal defense for employee. DUI charge on 2025-12-20. BAC 0.09. First offense. Pre-trial diversion eligible.',
  'pending', 'a5555555-5555-5555-5555-555555555555'::uuid, id, NULL
FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b7777777-7777-7777-7777-777777777777'::uuid,
  'Chen - Wrongful Termination Claim',
  'Former employee filed wrongful termination claim. Alleges discrimination. EEOC charge filed. Response deadline 2026-04-15.',
  'active', 'a2222222-2222-2222-2222-222222222222'::uuid, id, '2026-04-15'
FROM users WHERE email = 'attorney@lexflow.test'
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, title, description, status, client_id, assigned_attorney_id, sol_date)
SELECT 'b8888888-8888-8888-8888-888888888888'::uuid,
  'O Connor - Beach House Purchase',
  'Real estate transaction. Purchase at 22 Seawall Blvd, Galveston. Contract price $1.2M. Closing May 2026.',
  'closed', 'a4444444-4444-4444-4444-444444444444'::uuid, id, NULL
FROM users WHERE email = 'admin@lexflow.test'
ON CONFLICT DO NOTHING;

-- ============================================================
-- CONTACTS (10)
-- ============================================================
INSERT INTO contacts (name, email, phone, company, role, client_id, notes) VALUES
  ('Dr. James Williams', 'jwilliams@austinortho.com', '(555) 111-2222', 'Austin Orthopedics', 'Treating Physician', 'a1111111-1111-1111-1111-111111111111'::uuid, 'Martinez treating physician.'),
  ('Officer Mike Torres', 'mtorres@austinpd.gov', '(555) 222-3333', 'Austin Police Department', 'Responding Officer', 'a1111111-1111-1111-1111-111111111111'::uuid, 'Responded to rideshare accident. Badge #4521.'),
  ('Linda Chen', 'lchen@email.com', '(555) 333-4444', NULL, 'Spouse', 'a2222222-2222-2222-2222-222222222222'::uuid, 'David Chen wife. Co-trustee on estate documents.'),
  ('Tom Brennan', 'tbrennan@competitor.io', '(555) 444-5555', 'CompetitorTech Inc', 'Opposing Party', 'a2222222-2222-2222-2222-222222222222'::uuid, 'Defendant in trade secrets case.'),
  ('Judge Rebecca Foster', NULL, NULL, '353rd District Court', 'Judge', 'a3333333-3333-3333-3333-333333333333'::uuid, 'Assigned judge for custody modification.'),
  ('Mark Williams', 'mwilliams@email.com', '(555) 555-6666', NULL, 'Ex-Spouse', 'a3333333-3333-3333-3333-333333333333'::uuid, 'Opposing party in custody case.'),
  ('Robert O Connor Jr.', 'roconnorjr@email.com', '(555) 666-7777', 'O Connor Marine Services', 'Son / Beneficiary', 'a4444444-4444-4444-4444-444444444444'::uuid, 'Primary beneficiary.'),
  ('Elena Vasquez', 'evasquez@titleco.com', '(555) 777-8888', 'Gulf Coast Title Company', 'Title Agent', 'a4444444-4444-4444-4444-444444444444'::uuid, 'Handling title search for beach house.'),
  ('Dr. Anita Sharma', 'asharma@patelmedical.com', '(555) 888-9999', 'Patel Medical Group', 'Practice Manager', 'a5555555-5555-5555-5555-555555555555'::uuid, 'Point of contact for employment matters.'),
  ('ADA Jennifer Park', 'jpark@traviscountyda.gov', '(555) 999-0000', 'Travis County DA Office', 'Prosecutor', 'a5555555-5555-5555-5555-555555555555'::uuid, 'Assigned prosecutor for DUI case.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUDIT LOGS (sample)
-- ============================================================
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
SELECT id, 'client.create', 'client', 'a1111111-1111-1111-1111-111111111111'::uuid,
  '{"name":"Maria Martinez"}'::jsonb, '34.73.108.242'
FROM users WHERE email = 'attorney@lexflow.test';

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
SELECT id, 'matter.create', 'matter', 'b1111111-1111-1111-1111-111111111111'::uuid,
  '{"title":"Martinez v. Rideshare Corp"}'::jsonb, '34.73.108.242'
FROM users WHERE email = 'attorney@lexflow.test';

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
SELECT id, 'client.create', 'client', 'a2222222-2222-2222-2222-222222222222'::uuid,
  '{"name":"David Chen"}'::jsonb, '34.73.108.242'
FROM users WHERE email = 'attorney@lexflow.test';

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'users' AS entity, COUNT(*) AS count FROM users
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'matters', COUNT(*) FROM matters
UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
ORDER BY entity;
