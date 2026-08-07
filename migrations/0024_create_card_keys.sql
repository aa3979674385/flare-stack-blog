-- 卡密系统：卡密表 + 兑换记录表
CREATE TABLE card_key (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  batch_note TEXT,
  membership_days INTEGER,
  points_a INTEGER,
  points_b INTEGER,
  status TEXT NOT NULL DEFAULT 'unused',
  redeemed_by TEXT,
  redeemed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX card_key_status_idx ON card_key (status);
CREATE INDEX card_key_created_at_idx ON card_key (created_at);

CREATE TABLE card_key_redemption (
  id TEXT PRIMARY KEY NOT NULL,
  card_key_id TEXT NOT NULL REFERENCES card_key(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  membership_days_granted INTEGER,
  points_a_granted INTEGER,
  points_b_granted INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX card_key_redemption_user_id_idx ON card_key_redemption (user_id);
