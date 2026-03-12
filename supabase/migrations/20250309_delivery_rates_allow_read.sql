-- Fix: allow reading delivery_rates when using anon key (e.g. app auth without Supabase Auth)
-- Run this in Supabase SQL Editor if the table exists but admin panel shows "таблица не создана или пуста"

-- Allow anyone to read (anon + authenticated)
CREATE POLICY "Allow read for all" ON delivery_rates
  FOR SELECT USING (true);

-- Allow anyone to update (so admin can save rates when using anon key)
CREATE POLICY "Allow update for all" ON delivery_rates
  FOR UPDATE USING (true);
