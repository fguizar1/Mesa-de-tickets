import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { pool } from "../db";
import { HttpError } from "../errors";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; name: string; role: "usuario" | "admin" };
    }
  }
}

export async function auth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Falta el token de autenticación");
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new HttpError(401, "Token inválido o expirado");
  }

  const userId = Number(typeof payload === "object" ? payload.sub : undefined);
  if (!Number.isInteger(userId)) throw new HttpError(401, "Token inválido");

  const { rows } = await pool.query("SELECT id, name, role FROM users WHERE id = $1", [userId]);
  if (!rows[0]) throw new HttpError(401, "Usuario no válido");

  req.user = rows[0];
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    throw new HttpError(403, "Solo administradores pueden realizar esta acción");
  }
  next();
}