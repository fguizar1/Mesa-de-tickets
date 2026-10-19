import { Router } from "express";
import { pool } from "../db";
import { requireAdmin } from "../middleware/auth";

const router = Router();


router.get("/", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name, role FROM users ORDER BY name");
  res.json(rows);
});

export default router;