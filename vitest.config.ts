import "dotenv/config";
import { defineConfig } from "vitest/config";

const testDb = process.env.DATABASE_URL_TEST;
if (!testDb) {
  throw new Error("Define DATABASE_URL_TEST en .env (una base distinta a la de desarrollo)");
}

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    env: {
      // Esto tiene prioridad sobre el .env, así que las pruebas nunca tocan tu base real.
      DATABASE_URL: testDb,
      JWT_SECRET: "secreto-solo-para-pruebas-0123456789abcdef",
      BCRYPT_ROUNDS: "4",
    },
  },
});