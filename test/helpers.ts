import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/app";
import { pool } from "../src/db";

export const app = createApp();
export const PASSWORD = "Password-de-prueba-1";

// IDs tras resetDb(): Ana=1, Beto=2 (usuarios); Carlos=3, Lucía=4 (admins)
export async function resetDb() {
  const { rows } = await pool.query("SELECT current_database() AS db");
  if (!String(rows[0].db).includes("test")) {
    throw new Error(`Las pruebas solo corren en bases con "test" en el nombre (actual: ${rows[0].db})`);
  }
  await pool.query("TRUNCATE ticket_history, tickets, users RESTART IDENTITY CASCADE");
  const hash = await bcrypt.hash(PASSWORD, 4);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
       ('Ana',    'ana@test.com',    $1, 'usuario'),
       ('Beto',   'beto@test.com',   $1, 'usuario'),
       ('Carlos', 'carlos@test.com', $1, 'admin'),
       ('Lucía',  'lucia@test.com',  $1, 'admin')`,
    [hash]
  );
}

export async function login(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return { Authorization: `Bearer ${res.body.token}` };
}

export async function createTicket(
  headers: Record<string, string>,
  data: Record<string, unknown> = {}
) {
  const res = await request(app)
    .post("/api/tickets")
    .set(headers)
    .send({ title: "Falla en el reporte", description: "No exporta", priority: "media", ...data });
  return res.body as { id: number };
}