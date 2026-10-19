import { z } from "zod";
import { pool } from "../db";
import { HttpError, PRIORITIES, STATUSES } from "../errors";

export type Viewer = { id: number; role: "usuario" | "admin" };

export const listQuerySchema = z.object({
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(STATUSES).optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(["created_at", "updated_at", "priority"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

const SELECT_TICKET = `
  SELECT t.id, t.title, t.description, t.priority, t.status,
         t.reporter_id, r.name AS reporter_name,
         t.assignee_id, a.name AS assignee_name,
         t.created_at, t.updated_at
  FROM tickets t
  JOIN users r ON r.id = t.reporter_id
  LEFT JOIN users a ON a.id = t.assignee_id`;

// Lista cerrada: nunca se interpola texto que venga del cliente en el ORDER BY.
const SORT_COLUMNS = {
  created_at: "t.created_at",
  updated_at: "t.updated_at",
  priority: "CASE t.priority WHEN 'baja' THEN 1 WHEN 'media' THEN 2 WHEN 'alta' THEN 3 ELSE 4 END",
} as const;

export async function listTickets(viewer: Viewer, q: ListQuery) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };

  // Regla de visibilidad, aplicada siempre en el servidor.
  if (viewer.role !== "admin") add("t.reporter_id = ?", viewer.id);
  if (q.priority) add("t.priority = ?", q.priority);
  if (q.status) add("t.status = ?", q.status);
  if (q.assigneeId) add("t.assignee_id = ?", q.assigneeId);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const direction = q.order === "asc" ? "ASC" : "DESC";
  // t.id desempata para que la paginación sea estable.
  const orderBy = `${SORT_COLUMNS[q.sortBy]} ${direction}, t.id DESC`;

  const [list, count] = await Promise.all([
    pool.query(
      `${SELECT_TICKET} ${where} ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, q.offset]
    ),
    pool.query(`SELECT count(*)::int AS total FROM tickets t ${where}`, params),
  ]);

  return { data: list.rows, total: count.rows[0].total, limit: q.limit, offset: q.offset };
}

export async function getTicket(viewer: Viewer, id: number) {
  const params: unknown[] = [id];
  let where = "WHERE t.id = $1";
  if (viewer.role !== "admin") {
    params.push(viewer.id);
    where += " AND t.reporter_id = $2";
  }

  const { rows } = await pool.query(`${SELECT_TICKET} ${where}`, params);
  // Mismo 404 si no existe o no es tuyo: no se revela que el ticket existe.
  if (!rows[0]) throw new HttpError(404, "Ticket no encontrado");
  return rows[0];
}

export async function getHistory(viewer: Viewer, id: number) {
  await getTicket(viewer, id); // verifica existencia y visibilidad

  // CASE evita que Postgres intente convertir a entero valores de "status" como 'abierto'.
  const { rows } = await pool.query(
    `SELECT h.id, h.field, h.old_value, h.new_value, h.changed_at,
            u.name AS actor, uo.name AS old_name, un.name AS new_name
     FROM ticket_history h
     JOIN users u ON u.id = h.actor_id
     LEFT JOIN users uo ON uo.id = CASE WHEN h.field = 'assignee_id' THEN h.old_value::int END
     LEFT JOIN users un ON un.id = CASE WHEN h.field = 'assignee_id' THEN h.new_value::int END
     WHERE h.ticket_id = $1
     ORDER BY h.changed_at, h.id`,
    [id]
  );
  return rows;
}