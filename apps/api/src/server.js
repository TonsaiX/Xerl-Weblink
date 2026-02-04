import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initTables } from "./db.js";
import { publicRouter } from "./routes.public.js";
import { internalRouter } from "./routes.internal.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/**
 * ✅ Health
 */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * ✅ Routers
 */
app.use("/public", publicRouter);
app.use("/internal", internalRouter);

/**
 * ✅ Start
 */
const port = Number(process.env.API_PORT || 8080);

initTables()
  .then(() => {
    app.listen(port, () => {
      console.log(`[API] running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("[API] initTables failed", err);
    process.exit(1);
  });
