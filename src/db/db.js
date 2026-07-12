import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const placeholderPattern =
  /postgresql:\/\/(user|username):password@host:5432\/dbname/i;

if (placeholderPattern.test(process.env.DATABASE_URL)) {
  throw new Error(
    "Please replace the placeholder DATABASE_URL in .env with your Neon connection string.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool);
