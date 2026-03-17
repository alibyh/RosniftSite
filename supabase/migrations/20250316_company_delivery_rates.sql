-- Per-company delivery rates table.
-- One row per БЕ; all 8 rate combinations are flat columns.
-- Defaults match the original global rates from delivery_rates.
-- Run in Supabase SQL Editor: Dashboard > SQL Editor > New query

CREATE TABLE IF NOT EXISTS company_delivery_rates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  be           text        NOT NULL UNIQUE,
  company_name text,
  -- 10–18 t
  rate_10_18_50_250    numeric(10,2) NOT NULL DEFAULT 23.03,
  rate_10_18_251_1000  numeric(10,2) NOT NULL DEFAULT 13.73,
  rate_10_18_1001_2999 numeric(10,2) NOT NULL DEFAULT 11.82,
  rate_10_18_3000plus  numeric(10,2) NOT NULL DEFAULT 11.76,
  -- over 18 t
  rate_over18_50_250    numeric(10,2) NOT NULL DEFAULT 12.58,
  rate_over18_251_1000  numeric(10,2) NOT NULL DEFAULT 9.67,
  rate_over18_1001_2999 numeric(10,2) NOT NULL DEFAULT 8.92,
  rate_over18_3000plus  numeric(10,2) NOT NULL DEFAULT 8.89,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_delivery_rates ENABLE ROW LEVEL SECURITY;

-- Open policies (same pattern as delivery_rates_allow_read.sql)
CREATE POLICY "company_rates_select" ON company_delivery_rates FOR SELECT USING (true);
CREATE POLICY "company_rates_insert" ON company_delivery_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "company_rates_update" ON company_delivery_rates FOR UPDATE USING (true);
