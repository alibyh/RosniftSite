-- Chat system: conversations between buyer and seller company managers
-- Run in Supabase SQL Editor: Dashboard > SQL Editor > New query

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  -- All company IDs allowed to access this conversation (buyer + sellers)
  participant_company_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on conversations" ON conversations
  FOR ALL USING (true) WITH CHECK (true);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on chat_messages" ON chat_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for chat_messages so both parties get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
