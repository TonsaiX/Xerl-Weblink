import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

/**
 * ✅ PostgreSQL Pool
 * - ใช้ DATABASE_URL จาก .env
 */
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * ✅ initTables: สร้างตารางที่จำเป็น ถ้ายังไม่มี
 */
export async function initTables() {
  // topics: เก็บหัวข้อ + ลิ้งก์ (หน้า preview จะอ่านจากตารางนี้)
  // config: เก็บ allowed_role_id (ยศที่มีสิทธิใช้ bot)
  // logs: เก็บ log การกระทำ
  const sql = `
  CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_by_user_id TEXT NOT NULL,
    created_by_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    allowed_role_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  INSERT INTO config (id, allowed_role_id)
  VALUES (1, NULL)
  ON CONFLICT (id) DO NOTHING;

  CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,               -- TOPIC_CREATE / TOPIC_REMOVE / CONFIG_SET_ROLE
    topic_id INTEGER,
    actor_user_id TEXT NOT NULL,
    actor_tag TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `;

  await pool.query(sql);
}
