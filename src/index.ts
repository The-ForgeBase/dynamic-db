import { serve } from "@hono/node-server";
import { Hono } from "hono";
import knex from "knex";
import KnexHooks from "./hookableDb.js";
import { DBInspector } from "./inspector.js";

// Initialize Knex with SQLite for simplicity
const knexInstance = knex({
  client: "sqlite3",
  connection: {
    filename: "./data.db",
  },
  useNullAsDefault: true, // Required for SQLite
});

const hookableDB = new KnexHooks(knexInstance);

// Real-time listener
hookableDB.on("beforeQuery", ({ tableName, context }) => {
  console.log(`[Real-Time Event] Mutation on ${tableName}:`, context);
  // Push updates via WebSocket, SSE, etc.
});

const app = new Hono();

// Utility: Error handling for async routes
const asyncHandler = (fn: any) => async (c: any) => {
  try {
    return await fn(c);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
};

const dbInspector = new DBInspector(knexInstance);

// Add a new route to get schema info
app.get(
  "/schema",
  asyncHandler(async (c: any) => {
    const schema = await dbInspector.getDatabaseSchema();
    return c.json(schema);
  })
);

/**
 * POST /schema
 * Request Body Example:
 * {
 *   "action": "create", // Options: "create", "delete"
 *   "tableName": "users",
 *   "columns": [
 *     { "name": "id", "type": "increments", "primary": true },
 *     { "name": "name", "type": "string" },
 *     { "name": "email", "type": "string", "unique": true }
 *   ]
 * }
 */
app.post(
  "/schema",
  asyncHandler(async (c: any) => {
    const { action, tableName, columns } = await c.req.json();

    if (!action || !tableName) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    if (action === "create") {
      // Create table
      await knexInstance.schema.createTable(tableName, (table) => {
        columns.forEach((col: any) => {
          let column;
          if (col.type === "increments") {
            column = table.increments(col.name);
          } else if (col.type === "string") {
            column = table.string(col.name);
          } else if (col.type === "integer") {
            column = table.integer(col.name);
          } else if (col.type === "boolean") {
            column = table.boolean(col.name);
          } else if (col.type === "decimal") {
            column = table.decimal(col.name);
          }

          // Apply modifiers
          if (col.primary) column!.primary();
          if (col.unique) column!.unique();
          if (col.notNullable) column!.notNullable();
        });
      });

      return c.json({ message: `Table ${tableName} created successfully` });
    } else if (action === "delete") {
      // Delete table
      await knexInstance.schema.dropTableIfExists(tableName);
      return c.json({ message: `Table ${tableName} deleted successfully` });
    }

    return c.json({ error: "Invalid action" }, 400);
  })
);

app.get(
  "/records/:tableName",
  asyncHandler(async (c: any) => {
    const tableName = c.req.param("tableName");
    console.log(c.req.query("filter"));
    const filter = c.req.query("filter")
      ? JSON.parse(c.req.query("filter"))
      : {};
    const limit = parseInt(c.req.query("limit"), 10) || 10;
    const offset = parseInt(c.req.query("offset"), 10) || 0;

    // Validate table name
    const validTables = ["users", "products", "orders"];
    if (!validTables.includes(tableName)) {
      return c.json({ error: "Invalid table name" }, 400);
    }

    // Validate query parameters
    if (typeof filter !== "object" || isNaN(limit) || isNaN(offset)) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }

    // Query the database safely
    const records = await hookableDB.query(
      tableName,
      (query) => {
        return query.where(filter).limit(limit).offset(offset);
      },
      { filter, limit, offset }
    );

    return c.json({ records });
  })
);

/**
 * POST /data/:tableName
 * Creates a new record in the specified table.
 * Request Body Example:
 * {
 *   "data": { "name": "John", "email": "john@example.com" }
 * }
 */
app.post(
  "/data/:tableName",
  asyncHandler(async (c: any) => {
    const tableName = c.req.param("tableName");
    const { data } = await c.req.json();

    // Validate table name
    const validTables = ["users", "products", "orders"];
    if (!validTables.includes(tableName)) {
      return c.json({ error: "Invalid table name" }, 400);
    }

    if (typeof data !== "object" || Object.keys(data).length === 0) {
      return c.json({ error: "Invalid data" }, 400);
    }

    const [id] = await hookableDB.mutate(
      tableName,
      "create",
      (query) => query.insert(data),
      data
    );
    return c.json({ message: "Record created", id });
  })
);

/**
 * DELETE /data/:tableName/:id
 * Deletes a record by ID from the specified table.
 */
app.delete(
  "/data/:tableName/:id",
  asyncHandler(async (c: any) => {
    const tableName = c.req.param("tableName");
    const id = c.req.param("id");

    // Validate table name
    const validTables = ["users", "products", "orders"];
    if (!validTables.includes(tableName)) {
      return c.json({ error: "Invalid table name" }, 400);
    }

    const deleted = await hookableDB.mutate(
      tableName,
      "delete",
      (query) => query.where({ id }).delete(),
      { id }
    );
    if (deleted === 0) {
      return c.json({ error: "Record not found" }, 404);
    }

    return c.json({ message: "Record deleted" });
  })
);

/**
 * PUT /data/:tableName/:id
 * Updates a record by ID in the specified table.
 * Request Body Example:
 * {
 *   "data": { "name": "John Doe", "email": "john.doe@example.com" }
 * }
 */
app.put(
  "/data/:tableName/:id",
  asyncHandler(async (c: any) => {
    const tableName = c.req.param("tableName");
    const id = c.req.param("id");
    const { data } = await c.req.json();

    // Validate table name
    const validTables = ["users", "products", "orders"];
    if (!validTables.includes(tableName)) {
      return c.json({ error: "Invalid table name" }, 400);
    }

    if (typeof data !== "object" || Object.keys(data).length === 0) {
      return c.json({ error: "Invalid data" }, 400);
    }

    const updated = await hookableDB.mutate(
      tableName,
      "update",
      (query) => query.where({ id }).update(data),
      { id, ...data }
    );
    if (updated === 0) {
      return c.json({ error: "Record not found" }, 404);
    }

    return c.json({ message: "Record updated" });
  })
);

const port = 3000;

async function startServer() {
  console.log(`Server is running on http://localhost:${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

startServer().catch(console.error);
