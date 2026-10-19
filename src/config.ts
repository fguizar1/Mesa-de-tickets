import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
};

if (config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
}