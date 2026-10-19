import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { pool } from "../db";
import { HttpError } from "../errors";

const router = Router();

// Se compara contra este hash cuando el correo no existe, para que la respuesta
// tarde lo mismo y no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync("contraseña-falsa", config.bcryptRounds);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(1, "Falta la contraseña").max(200),
});

router.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const { rows } = await pool.query(
    "SELECT id, name, role, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = rows[0];

  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, "Correo o contraseña incorrectos");

  const token = jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
  });

  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

export default router;