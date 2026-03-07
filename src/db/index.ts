import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const url = new URL(connectionString);

    const client = postgres({
      host: url.hostname,
      port: Number(url.port) || 5432,
      database: url.pathname.replace("/", ""),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: "require",
      prepare: false,
      max: 1,
    });

    _db = drizzle(client, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});