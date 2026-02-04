import express from "express";
import { pool } from "./db.js";

export const internalRouter = express.Router();

/* ===== CREATE TOPIC ===== */
internalRouter.post("/topic.create", async (req, res) => {
  try {
    const { title, url, description, image_url, actor } = req.body || {};

    if (!title || !url || !actor?.userId || !actor?.tag) {
      return res.status(400).json({ ok: false });
    }

    const image = image_url && image_url !== "-" ? String(image_url) : "-";

    const { rows } = await pool.query(
      `INSERT INTO topics
       (title, url, description, image_url, created_by_user_id, created_by_tag)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [
        title,
        url,
        description || "",
        image,
        actor.userId,
        actor.tag
      ]
    );

    res.json({ ok: true, topicId: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

/* ===== REMOVE TOPIC ===== */
internalRouter.post("/topic.remove", async (req, res) => {
  try {
    const { id, actor } = req.body || {};
    if (!id || !actor) return res.status(400).json({ ok: false });

    const r = await pool.query(
      `UPDATE topics SET is_deleted=TRUE WHERE id=$1 AND is_deleted=FALSE`,
      [id]
    );

    res.json({ ok: true, removed: r.rowCount > 0 });
  } catch {
    res.status(500).json({ ok: false });
  }
});
