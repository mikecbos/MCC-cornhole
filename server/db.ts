import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Connect to the database
client.connect().catch(err => {
  console.error("Failed to connect to the database:", err);
});

// Create drizzle instance
export const db = drizzle(client, { schema });