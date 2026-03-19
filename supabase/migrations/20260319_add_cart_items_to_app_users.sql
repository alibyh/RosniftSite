-- Persist per-user cart across devices/sessions
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS cart_items jsonb NOT NULL DEFAULT '[]'::jsonb;
