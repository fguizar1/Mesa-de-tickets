import { createApp } from "./app";
import { config } from "./config";
import { closePool } from "./db";

const server = createApp().listen(config.port, () => {
  console.log(`API en http://localhost:${config.port}`);
});

let closing = false;

function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`${signal} recibido, cerrando...`);

  // Si algo se queda colgado, se fuerza la salida a los 10 s.
  setTimeout(() => process.exit(1), 10_000).unref();

  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));