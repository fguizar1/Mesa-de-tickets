import { pool } from "../db";
import { HttpError, ALLOWED_TRANSITIONS, type Status } from "../errors";

export async function changeStatus(ticketId: number, newStatus: Status, actorId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT status FROM tickets WHERE id = $1 FOR UPDATE",
      [ticketId]
    );
    if (!rows[0]) throw new HttpError(404, "Ticket no encontrado");

    const current = rows[0].status as Status;
    if (!ALLOWED_TRANSITIONS[current].includes(newStatus)) {
      throw new HttpError(409, `No se puede cambiar un ticket de "${current}" a "${newStatus}"`);
    }

    const updated = await client.query(
      "UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [newStatus, ticketId]
    );

    await client.query(
      `INSERT INTO ticket_history (ticket_id, actor_id, field, old_value, new_value)
       VALUES ($1, $2, 'status', $3, $4)`,
      [ticketId, actorId, current, newStatus]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function assignTicket(ticketId: number, assigneeId: number, actorId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ticket = await client.query(
      "SELECT status, assignee_id FROM tickets WHERE id = $1 FOR UPDATE",
      [ticketId]
    );
    if (!ticket.rows[0]) throw new HttpError(404, "Ticket no encontrado");
    if (ticket.rows[0].status === "cerrado") {
      throw new HttpError(409, "No se puede asignar un ticket cerrado");
    }

    const assignee = await client.query("SELECT role FROM users WHERE id = $1", [assigneeId]);
    if (assignee.rows[0]?.role !== "admin") {
      throw new HttpError(400, "El responsable debe ser un administrador");
    }

    const old = ticket.rows[0].assignee_id;
    const updated = await client.query(
      "UPDATE tickets SET assignee_id = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [assigneeId, ticketId]
    );

    await client.query(
      `INSERT INTO ticket_history (ticket_id, actor_id, field, old_value, new_value)
       VALUES ($1, $2, 'assignee_id', $3, $4)`,
      [ticketId, actorId, old?.toString() ?? null, assigneeId.toString()]
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}