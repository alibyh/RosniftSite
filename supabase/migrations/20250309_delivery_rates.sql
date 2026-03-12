-- Delivery rates table for transport tariff calculation
-- Run this in Supabase SQL Editor: Dashboard > SQL Editor > New query

CREATE TABLE IF NOT EXISTS delivery_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weight_band text NOT NULL CHECK (weight_band IN ('10-18', 'over18')),
  distance_band text NOT NULL CHECK (distance_band IN ('50-250', '251-1000', '1001-2999', '3000+')),
  rate numeric(10, 2) NOT NULL CHECK (rate >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (weight_band, distance_band)
);

-- Enable RLS
ALTER TABLE delivery_rates ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (adjust policy to match your auth setup)
CREATE POLICY "Allow read for authenticated" ON delivery_rates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for service role" ON delivery_rates
  FOR ALL USING (auth.role() = 'service_role');

-- For anon/authenticated write if you use that
CREATE POLICY "Allow insert for authenticated" ON delivery_rates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated" ON delivery_rates
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Insert default rates (from deliveryCalculation.md)
INSERT INTO delivery_rates (weight_band, distance_band, rate) VALUES
  ('10-18', '50-250', 23.03),
  ('10-18', '251-1000', 13.73),
  ('10-18', '1001-2999', 11.82),
  ('10-18', '3000+', 11.76),
  ('over18', '50-250', 12.58),
  ('over18', '251-1000', 9.67),
  ('over18', '1001-2999', 8.92),
  ('over18', '3000+', 8.89)
ON CONFLICT (weight_band, distance_band) DO NOTHING;
