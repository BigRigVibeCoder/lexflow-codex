-- LexFlow E2E Test Seed Script
-- Creates all tables and seeds test users

-- Enums
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('owner','attorney','paralegal','bookkeeper','intake_specialist'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active','suspended','deactivated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE matter_status AS ENUM ('active','closed','pending','on_hold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE document_category AS ENUM ('pleading','correspondence','evidence','contract','invoice','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified TIMESTAMPTZ,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'paralegal',
  status user_status NOT NULL DEFAULT 'active',
  bar_number VARCHAR(50),
  totp_secret VARCHAR(255),
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  totp_verified_at TIMESTAMPTZ,
  recovery_codes TEXT[],
  last_login_at TIMESTAMPTZ,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matters table
CREATE TABLE IF NOT EXISTS matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status matter_status NOT NULL DEFAULT 'active',
  client_id UUID REFERENCES clients(id),
  assigned_attorney_id UUID REFERENCES users(id),
  sol_date DATE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  category document_category NOT NULL DEFAULT 'other',
  matter_id UUID REFERENCES matters(id),
  uploaded_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  role VARCHAR(100),
  client_id UUID REFERENCES clients(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document access log table
CREATE TABLE IF NOT EXISTS document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed test users (argon2id hashes generated locally)
INSERT INTO users (email, password_hash, full_name, role, status, bar_number)
VALUES
  ('admin@lexflow.test', '$argon2id$v=19$m=65536,t=3,p=4$C1AAI1UkI8sQzJKZtO/+Jw$mEJOAlAn4I1t10a8m+PXYEg2tMAmfL5/VFteOpQCA1A', 'E2E Admin User', 'owner', 'active', NULL),
  ('attorney@lexflow.test', '$argon2id$v=19$m=65536,t=3,p=4$wMJLPGkdwAIxWKdU7zoEiw$60e5oeMhmop8kMgWrnW2Kavazt3OMxk1P/x6gfXFuEg', 'E2E Attorney User', 'attorney', 'active', 'BAR-E2E-001'),
  ('staff@lexflow.test', '$argon2id$v=19$m=65536,t=3,p=4$SOjcXkYBsNQa4sF9azdx8A$nPW68P3RHU0CxrQS22iwEXzxd62O9Unp9FiAzJqh42M', 'E2E Staff User', 'paralegal', 'active', NULL)
ON CONFLICT (email) DO NOTHING;

-- Verify
SELECT email, role, status FROM users ORDER BY email;
