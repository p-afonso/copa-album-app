-- supabase/migrations/007_marketplace_trades.sql

ALTER TABLE albums ADD COLUMN marketplace_visible boolean NOT NULL DEFAULT false;

CREATE TABLE trade_proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposer_album   uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  offered_sticker  text NOT NULL,
  receiver_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_album   uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  wanted_sticker   text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trade_proposals_proposer_idx ON trade_proposals(proposer_id);
CREATE INDEX trade_proposals_receiver_idx ON trade_proposals(receiver_id);

ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_proposals_select" ON trade_proposals
  FOR SELECT USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

CREATE POLICY "trade_proposals_insert" ON trade_proposals
  FOR INSERT WITH CHECK (auth.uid() = proposer_id);

CREATE POLICY "trade_proposals_update" ON trade_proposals
  FOR UPDATE USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE trade_proposals;
