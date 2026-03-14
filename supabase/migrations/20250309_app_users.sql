-- App users table (replaces mock users)
-- Run in Supabase SQL Editor: Dashboard > SQL Editor > New query

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  balance_unit text,
  company_name text,
  branch text,
  company_id text,
  warehouses jsonb DEFAULT '[]'::jsonb,
  role text NOT NULL CHECK (role IN ('admin', 'manager')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read app_users" ON app_users FOR SELECT USING (true);
CREATE POLICY "Allow insert app_users" ON app_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update app_users" ON app_users FOR UPDATE USING (true);
CREATE POLICY "Allow delete app_users" ON app_users FOR DELETE USING (true);

-- Initial users: password=popopo for both
-- Hash generated via scripts/generatePasswordHash.mjs
INSERT INTO app_users (username, full_name, email, password_hash, balance_unit, company_name, company_id, role) VALUES
  ('alibyh', 'Али Б', 'alibyh@icloud.com', '5TMimuziXq4c3zDi6cvrkQ==:100000:3d9VCVJDiw6kfZr7TlKYR+64y1PYZKXv4YFvJYAavhg=', NULL, 'ООО "РН-Бурение"', '1244', 'admin'),
  ('yuliya', 'Yuliya', 'aloudbyh@gmail.com', '5TMimuziXq4c3zDi6cvrkQ==:100000:3d9VCVJDiw6kfZr7TlKYR+64y1PYZKXv4YFvJYAavhg=', NULL, 'АО "Куйбышевский НПЗ"', '1329', 'manager')
ON CONFLICT (username) DO NOTHING;
