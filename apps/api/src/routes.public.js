import express from "express";
import { pool } from "./db.js";

export const publicRouter = express.Router();

publicRouter.get("/topics", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, url, description, image_url
       FROM topics
       WHERE is_deleted = FALSE
       ORDER BY id DESC`
    );

    res.json({ ok: true, items: rows });
  } catch {
    res.status(500).json({ ok: false });
  }
});
