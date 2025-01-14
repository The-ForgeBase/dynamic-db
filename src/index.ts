import { serve } from "@hono/node-server";
import { Hono } from "hono";
import knex from "knex";
import KnexHooks from "./framework/knex-hooks.js";
import { DBInspector } from "./framework/inspector.js";
import { PermissionService } from "./framework/permissionService.js";
import type { TablePermissions, UserContext } from "./framework/types.js";
import { enforcePermissions } from "./framework/rlsManager.js";
import { QueryHandler } from "./sdk/server.js";
import { createDashboardRoutes } from "./dashboard/routes.js";
import { Framework } from "./framework/index.js";

// Initialize Knex with SQLite for simplicity
const knexInstance = knex({
  client: "sqlite3",
  connection: {
    filename: "./data.db",
  },
  useNullAsDefault: true, // Required for SQLite
});

export const permissionService = new PermissionService(knexInstance);

const hookableDB = new KnexHooks(knexInstance);

// Real-time listener
hookableDB.on("beforeQuery", ({ tableName, context }) => {
  console.log(`[Real-Time Event] Mutation on ${tableName}:`, context);
  // Push updates via WebSocket, SSE, etc.
});

const app = new Hono();

// Create framework instance for dashboard
const framework = new Framework({
  db: knexInstance,
  hooks: hookableDB,
  permissions: permissionService,
  realtime: true,
});

// Mount dashboard routes
app.route("/dashboard", createDashboardRoutes(framework));

// check  "/records/:tableName" to see how the rls and permissions are enforced
const user: UserContext = {
  userId: 1,
  labels: ["user"],
  teams: ["engineering"],
};

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
          } else if (col.type === "text") {
            column = table.text(col.name);
          } else if (col.type === "timestamp") {
            column = table.timestamp(col.name);
          } else if (col.type === "json") {
            column = table.json(col.name);
          } else if (col.type === "jsonb") {
            column = table.jsonb(col.name);
          } else if (col.type === "uuid") {
            column = table.uuid(col.name);
          } else if (col.type === "enum") {
            column = table.enum(col.name, col.values);
          } else if (col.type === "specificType") {
            column = table.specificType(col.name, col.type);
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
    const params = c.req.query();

    // Validate table name
    const validTables = ["users", "products", "orders"];
    if (!validTables.includes(tableName)) {
      return c.json({ error: "Invalid table name" }, 400);
    }

    // Parse query parameters
    let queryParams: Record<string, any> = {};

    Object.entries(params).forEach(([key, value]) => {
      try {
        // Try to parse as JSON first
        if (typeof value === "string") {
          try {
            queryParams[key] = JSON.parse(value);
          } catch {
            // If not JSON, handle as regular value
            if (key === "limit" || key === "offset") {
              queryParams[key] = parseInt(value, 10) || 10;
            } else {
              queryParams[key] = value;
            }
          }
        } else {
          queryParams[key] = value;
        }
      } catch (error) {
        console.warn(`Failed to parse parameter ${key}:`, error);
      }
    });

    console.log("Original Params:", params);
    console.log("Parsed Query Params:", queryParams);

    const handler = new QueryHandler(hookableDB.getKnexInstance());

    // Query the database safely
    const records = await hookableDB.query(
      tableName,
      (query) => {
        return handler.buildQuery(queryParams, query);
      },
      queryParams
    );

    // const filteredRows = await enforcePermissions(
    //   tableName,
    //   "SELECT",
    //   records,
    //   user
    // );

    return c.json({ records: records });
  })
);

/**
 * POST /data/:tableName
 * Creates one or more records in the specified table.
 * Request Body Example for single record:
 * {
 *   "data": { "name": "John", "email": "john@example.com" }
 * }
 * Request Body Example for multiple records:
 * {
 *   "data": [
 *     { "name": "John", "email": "john@example.com" },
 *     { "name": "Jane", "email": "jane@example.com" }
 *   ]
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

    // Handle both single record and array of records
    const isArray = Array.isArray(data);
    const records = isArray ? data : [data];

    // Validate records
    if (
      !records.length ||
      !records.every(
        (record) => typeof record === "object" && Object.keys(record).length > 0
      )
    ) {
      return c.json({ error: "Invalid data format" }, 400);
    }

    // Insert records
    const ids = await hookableDB.mutate(
      tableName,
      "create",
      (query) => query.insert(records).returning("id"),
      records
    );

    return c.json({
      message: `${records.length} record(s) created`,
      ids: ids,
      count: records.length,
    });
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

// Permission Management Routes
app.get(
  "/permissions/:tableName",
  asyncHandler(async (c: any) => {
    const tableName = c.req.param("tableName");
    const permissions = await permissionService.getPermissionsForTable(
      tableName
    );

    if (!permissions) {
      return c.json({ error: "No permissions found for table" }, 404);
    }

    return c.json(permissions);
  })
);

app.post(
  "/permissions/:tableName",
  asyncHandler(async (c: any) => {
    const tableName = c.req.param("tableName");
    const permissions = (await c.req.json()) as TablePermissions;

    if (!permissions?.operations) {
      return c.json({ error: "Invalid permissions format" }, 400);
    }

    await permissionService.setPermissionsForTable(tableName, permissions);
    return c.json({ message: "Permissions updated successfully" });
  })
);

app.delete(
  "/permissions/:tableName",
  asyncHandler(async (c: any) => {
    const tableName = c.req.param("tableName");
    await permissionService.deletePermissionsForTable(tableName);
    return c.json({ message: "Permissions deleted successfully" });
  })
);

const port = 3000;

async function startServer() {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Dashboard available at http://localhost:${port}/dashboard`);
  serve({
    fetch: app.fetch,
    port,
  });
}

startServer().catch(console.error);
