export interface AppEnv {
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: number;
  FRONTEND_ORIGIN: string;
  STORAGE_DRIVER: string;
  STORAGE_DIR: string;
  ATTACHMENT_MAX_BYTES: number;
  ATTACHMENT_ALLOWED_MIME: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const nodeEnv = String(config.NODE_ENV ?? "development");
  const databaseUrl = String(config.DATABASE_URL ?? "");
  const jwt = String(config.JWT_SECRET ?? "");
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  }
  if (jwt.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters");
  }
  if (nodeEnv === "production" && jwt.includes("dev-only")) {
    throw new Error("Refusing to start in production with the development JWT secret");
  }
  const storageDriver = String(config.STORAGE_DRIVER ?? "local");
  if (storageDriver !== "local") {
    throw new Error("Only the local storage driver is configured. Refusing to start with an unconfigured object-storage driver.");
  }
  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwt,
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? "8h"),
    PORT: Number(config.PORT ?? 3000),
    FRONTEND_ORIGIN: String(config.FRONTEND_ORIGIN ?? "http://localhost:5173"),
    STORAGE_DRIVER: storageDriver,
    STORAGE_DIR: String(config.STORAGE_DIR ?? "../storage"),
    ATTACHMENT_MAX_BYTES: Number(config.ATTACHMENT_MAX_BYTES ?? 10_485_760),
    ATTACHMENT_ALLOWED_MIME: String(
      config.ATTACHMENT_ALLOWED_MIME ??
        "text/plain,text/csv,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json",
    ),
    THROTTLE_TTL: Number(config.THROTTLE_TTL ?? 60_000),
    THROTTLE_LIMIT: Number(config.THROTTLE_LIMIT ?? 300),
  };
}
