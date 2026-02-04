/* =====================================================
   PostgreSQL Schema : Link Vault
   Compatible with Railway / Vercel
===================================================== */

SET client_encoding = 'UTF8';

/* =====================================================
   TABLE: topics
   - เก็บลิ้งก์สำหรับหน้าเว็บ preview
===================================================== */
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,

  title TEXT NOT NULL,                 -- ชื่อ topic
  url TEXT NOT NULL,                   -- ลิ้งก์ปลายทาง
  description TEXT DEFAULT '',         -- คำอธิบาย
  image_url TEXT DEFAULT '-',          -- URL รูป หรือ "-"

  created_by_user_id TEXT NOT NULL,    -- Discord user id
  created_by_tag TEXT NOT NULL,        -- Discord tag

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_topics_active
ON topics (is_deleted, id DESC);

/* =====================================================
   TABLE: config
   - เก็บค่าตั้งระบบ (Lock Config)
===================================================== */
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  allowed_role_id TEXT,                -- Discord Role ID
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO config (id, allowed_role_id)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

/* =====================================================
   TABLE: logs
   - เก็บ log ทุก action จาก Discord Bot
===================================================== */
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,

  action TEXT NOT NULL,
  -- ตัวอย่างค่า:
  -- TOPIC_CREATE
  -- TOPIC_REMOVE
  -- CONFIG_SET_ROLE

  topic_id INTEGER,
  actor_user_id TEXT NOT NULL,
  actor_tag TEXT NOT NULL,

  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_action
ON logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_topic
ON logs (topic_id);

/* =====================================================
   OPTIONAL: VIEW สำหรับดู log ง่ายขึ้น
===================================================== */
CREATE OR REPLACE VIEW v_logs_readable AS
SELECT
  l.id,
  l.action,
  l.topic_id,
  t.title AS topic_title,
  l.actor_user_id,
  l.actor_tag,
  l.detail,
  l.created_at
FROM logs l
LEFT JOIN topics t ON t.id = l.topic_id
ORDER BY l.created_at DESC;
