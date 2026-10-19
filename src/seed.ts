import bcrypt from "bcryptjs";
import { config } from "./config";
import { pool, closePool } from "./db";

const users = [
  { name: "Ana", email: "ana@example.com", role: "usuario" },
  { name: "Carlos", email: "carlos@example.com", role: "admin" },
  { name: "Lucía", email: "lucia@example.com", role: "admin" },
  { name: "Beto", email: "beto@example.com", role: "usuario" },
  { name: "Diana", email: "diana@example.com", role: "usuario" },
  { name: "Elena", email: "elena@example.com", role: "usuario" },
  { name: "Fabián", email: "fabián@example.com", role: "usuario" },
];

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("Define SEED_PASSWORD (mínimo 8 caracteres) en .env");
  }
  const hash = await bcrypt.hash(password, config.bcryptRounds);

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.role]
    );
  }
  console.log("Usuarios creados:", users.map((u) => u.email).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closePool);