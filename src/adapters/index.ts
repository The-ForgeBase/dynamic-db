import type { Knex } from "knex";
import { SQLiteAdapter } from "./sqlite.js";
import { PostgresAdapter } from "./postgres.js";
import type { DatabaseAdapter } from "./base.js";

export function getAdapter(knex: Knex): DatabaseAdapter {
  const client = knex.client.config.client;

  switch (client) {
    case "sqlite3":
      return new SQLiteAdapter();
    case "pg":
      return new PostgresAdapter();
    default:
      throw new Error(`Unsupported database client: ${client}`);
  }
}

export { DatabaseFeature } from "./base.js";
export type { DatabaseAdapter } from "./base.js";
