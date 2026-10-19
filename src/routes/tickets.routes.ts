import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { PRIORITIES, STATUSES } from "../errors";
import { requireAdmin } from "../middleware/auth";
import { changeStatus, assignTicket } from "../services/tickets.service";
import { getHistory, getTicket, listQuerySchema, listTickets } from "../services/tickets.queries";

const router = Router();

const idParam = z.coerce.number().int().positive().max(2_147_483_647);

const createSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres")
    .max(120, "El título admite hasta 120 caracteres"),
  description: z.string().trim().min(1, "La descripción es obligatoria")
    .max(2000, "La descripción admite hasta 2000 caracteres"),
  priority: z.enum(PRIORITIES).default("media"),
});

router.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const { rows } = await pool.query(
    `INSERT INTO tickets (title, description, priority, reporter_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.title, data.description, data.priority, req.user!.id]
  );
  res.status(201).json(rows[0]);
});

router.get("/", async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  res.json(await listTickets(req.user!, query));
});

router.get("/:id", async (req, res) => {
  res.json(await getTicket(req.user!, idParam.parse(req.params.id)));
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { status } = z.object({ status: z.enum(STATUSES) }).parse(req.body);
  res.json(await changeStatus(id, status, req.user!.id));
});

router.patch("/:id/assign", requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { assigneeId } = z.object({ assigneeId: z.number().int().positive() }).parse(req.body);
  res.json(await assignTicket(id, assigneeId, req.user!.id));
});

router.get("/:id/history", async (req, res) => {
  res.json(await getHistory(req.user!, idParam.parse(req.params.id)));
});

export default router;