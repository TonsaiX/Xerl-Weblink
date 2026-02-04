import express from "express";
import { pool } from "./db.js";

export const internalRouter = express.Router();

function isValidHttpUrl(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ===== CREATE TOPIC ===== */
internalRouter.post("/topic.create", async (req, res) => {
  try {
    const { title, url, description, image_url, actor } = req.body || {};

    // validate required fields
    if (!title || !url || !actor?.userId || !actor?.tag) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    // validate url
    if (!isValidHttpUrl(String(url))) {
      return res.status(400).json({ ok: false, error: "invalid_url" });
    }

    const safeTitle = String(title).trim();
    const safeUrl = String(url).trim();
    const safeDesc = description ? String(description) : "";

    // image: allow "-" or valid http url
    let image = "-";
    if (image_url && String(image_url).trim() !== "-") {
      const img = String(image_url).trim();
      image = isValidHttpUrl(img) ? img : "-";
    }

    const { rows } = await pool.query(
      `INSERT INTO topics
       (title, url, description, image_url, created_by_user_id, created_by_tag)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [safeTitle, safeUrl, safeDesc, image, String(actor.userId), String(actor.tag)]
    );

    res.json({ ok: true, topicId: rows[0].id });
  } catch (err) {
    console.error("[/internal/topic.create] error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* ===== REMOVE TOPIC ===== */
internalRouter.post("/topic.remove", async (req, res) => {
  try {
    const { id, actor } = req.body || {};
    if (!id || !actor?.userId) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    const r = await pool.query(
      `UPDATE topics
       SET is_deleted=TRUE
       WHERE id=$1 AND is_deleted=FALSE`,
      [id]
    );

    res.json({ ok: true, removed: r.rowCount > 0 });
  } catch (err) {
    console.error("[/internal/topic.remove] error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});
