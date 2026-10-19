import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../src/db";
import { app, createTicket, login, resetDb } from "./helpers";

let ana: Record<string, string>;
let beto: Record<string, string>;
let carlos: Record<string, string>;

beforeEach(async () => {
  await resetDb();
  ana = await login("ana@test.com");
  beto = await login("beto@test.com");
  carlos = await login("carlos@test.com");
});

afterAll(() => pool.end());

describe("autenticación", () => {
  it("rechaza peticiones sin token", async () => {
    await request(app).get("/api/tickets").expect(401);
  });

  it("rechaza un token inválido", async () => {
    await request(app).get("/api/tickets").set("Authorization", "Bearer abc").expect(401);
  });

  it("ya no acepta X-User-Id como identidad", async () => {
    await request(app).get("/api/tickets").set("X-User-Id", "3").expect(401);
  });

  it("rechaza credenciales incorrectas", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@test.com", password: "incorrecta" })
      .expect(401);
  });
});

describe("creación y validación", () => {
  it("crea un ticket a nombre del usuario autenticado", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set(ana)
      .send({ title: "  No abre la app  ", description: "Pantalla en blanco", priority: "alta" })
      .expect(201);
    expect(res.body).toMatchObject({
      title: "No abre la app", // se recortan los espacios
      status: "abierto",
      reporter_id: 1,
      assignee_id: null,
    });
  });

  it("rechaza un título corto y una prioridad inválida", async () => {
    await request(app).post("/api/tickets").set(ana)
      .send({ title: "ab", description: "x" }).expect(400);
    await request(app).post("/api/tickets").set(ana)
      .send({ title: "Título válido", description: "x", priority: "urgentisima" }).expect(400);
  });
});

describe("visibilidad", () => {
  it("un usuario solo ve sus tickets y un admin ve todos", async () => {
    await createTicket(ana);
    await createTicket(beto);

    const delUsuario = await request(app).get("/api/tickets").set(ana).expect(200);
    expect(delUsuario.body.total).toBe(1);
    expect(delUsuario.body.data[0].reporter_id).toBe(1);

    const delAdmin = await request(app).get("/api/tickets").set(carlos).expect(200);
    expect(delAdmin.body.total).toBe(2);
  });

  it("devuelve 404 al consultar el ticket o el historial de otro usuario", async () => {
    const ticket = await createTicket(ana);
    await request(app).get(`/api/tickets/${ticket.id}`).set(beto).expect(404);
    await request(app).get(`/api/tickets/${ticket.id}/history`).set(beto).expect(404);
    await request(app).get(`/api/tickets/${ticket.id}`).set(ana).expect(200);
  });

  it("devuelve 404 si el ticket no existe", async () => {
    await request(app).get("/api/tickets/9999").set(carlos).expect(404);
  });
});

describe("permisos", () => {
  it("un usuario normal no puede asignar ni cambiar el estado", async () => {
    const ticket = await createTicket(ana);
    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set(ana)
      .send({ assigneeId: 3 }).expect(403);
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set(ana)
      .send({ status: "cerrado" }).expect(403);
  });

  it("el responsable debe ser administrador", async () => {
    const ticket = await createTicket(ana);
    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set(carlos)
      .send({ assigneeId: 2 }).expect(400);
  });
});

describe("estados e historial", () => {
  it("no permite cerrar un ticket que ya está cerrado", async () => {
    const ticket = await createTicket(ana);
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set(carlos)
      .send({ status: "cerrado" }).expect(200);
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set(carlos)
      .send({ status: "cerrado" }).expect(409);
  });

  it("registra quién hizo cada cambio y cuándo", async () => {
    const ticket = await createTicket(ana);
    await request(app).patch(`/api/tickets/${ticket.id}/assign`).set(carlos)
      .send({ assigneeId: 4 }).expect(200);
    await request(app).patch(`/api/tickets/${ticket.id}/status`).set(carlos)
      .send({ status: "en_progreso" }).expect(200);

    const res = await request(app).get(`/api/tickets/${ticket.id}/history`).set(ana).expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ field: "assignee_id", actor: "Carlos", new_name: "Lucía" });
    expect(res.body[1]).toMatchObject({
      field: "status", actor: "Carlos", old_value: "abierto", new_value: "en_progreso",
    });
    expect(Date.parse(res.body[1].changed_at)).not.toBeNaN();
  });
});

describe("filtros, orden y paginación", () => {
  it("filtra por prioridad, responsable y estado", async () => {
    const a = await createTicket(ana, { priority: "alta" });
    await createTicket(ana, { priority: "baja" });
    await request(app).patch(`/api/tickets/${a.id}/assign`).set(carlos).send({ assigneeId: 4 });

    const porPrioridad = await request(app).get("/api/tickets?priority=alta").set(carlos);
    expect(porPrioridad.body.total).toBe(1);

    const porResponsable = await request(app).get("/api/tickets?assigneeId=4").set(carlos);
    expect(porResponsable.body.data.map((t: { id: number }) => t.id)).toEqual([a.id]);

    const porEstado = await request(app).get("/api/tickets?status=cerrado").set(carlos);
    expect(porEstado.body.total).toBe(0);
  });

  it("pagina y respeta el límite máximo", async () => {
    for (let i = 0; i < 3; i++) await createTicket(ana);

    const pagina = await request(app).get("/api/tickets?limit=2&offset=2").set(carlos).expect(200);
    expect(pagina.body).toMatchObject({ total: 3, limit: 2, offset: 2 });
    expect(pagina.body.data).toHaveLength(1);

    await request(app).get("/api/tickets?limit=1000").set(carlos).expect(400);
    await request(app).get("/api/tickets?sortBy=password_hash").set(carlos).expect(400);
  });
});

describe("atomicidad", () => {
  it("si falla el historial, el cambio de estado se revierte", async () => {
    const ticket = await createTicket(ana);
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Fuerza que cualquier INSERT en el historial falle a mitad de la transacción.
    await pool.query(`
      CREATE OR REPLACE FUNCTION fallar_historial() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'fallo simulado'; END;
      $$ LANGUAGE plpgsql`);
    await pool.query(`
      CREATE TRIGGER fallar_historial_trg BEFORE INSERT ON ticket_history
      FOR EACH ROW EXECUTE FUNCTION fallar_historial()`);

    try {
      await request(app).patch(`/api/tickets/${ticket.id}/status`).set(carlos)
        .send({ status: "cerrado" }).expect(500);

      const { rows } = await pool.query("SELECT status FROM tickets WHERE id = $1", [ticket.id]);
      expect(rows[0].status).toBe("abierto"); // sin cambios parciales
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS fallar_historial_trg ON ticket_history");
      await pool.query("DROP FUNCTION IF EXISTS fallar_historial()");
      vi.restoreAllMocks();
    }
  });
});
