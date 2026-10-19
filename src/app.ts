import express, { type NextFunction, type Request, type Response } from "express";
import path from "path";
import { ZodError } from "zod";
import { pool } from "./db";
import { HttpError } from "./errors";
import { auth } from "./middleware/auth";
import authRouter from "./routes/auth.routes";
import usersRouter from "./routes/users.routes";
import ticketsRouter from "./routes/tickets.routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "error" });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", auth, usersRouter);
  app.use("/api/tickets", auth, ticketsRouter);
  app.use("/api", () => {
    throw new HttpError(404, "Ruta no encontrada");
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Datos inválidos", details: err.issues });
    }
    if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
      return res.status(400).json({ error: "El cuerpo no es un JSON válido" });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  });

  return app;
}