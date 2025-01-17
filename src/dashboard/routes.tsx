import { Hono } from "hono";
import { Layout } from "./layout.js";
import { SchemaView } from "./components/schema.js";
import { DataView } from "./components/data.js";
import { PermissionsView } from "./components/permissions.js";

import type { Framework } from "../framework/index.js";

export const createDashboardRoutes = (framework: Framework) => {
  const app = new Hono();

  // Dashboard home
  app.get("/", (c) => c.redirect("/dashboard/schema"));

  // Schema routes
  app.get("/schema", async (c) => {
    const schema = await framework.endpoints.schema.get();
    return c.html(
      <Layout title="Schema">
        <SchemaView schema={schema} />
      </Layout>
    );
  });

  // Handle table creation
  app.post("/schema", async (c) => {
    const formData = await c.req.parseBody();
    const tableName = formData.tableName as string;
    const rawColumns = formData.columns;

    // Handle array of columns from form data
    const columns: any[] = Array.isArray(rawColumns)
      ? rawColumns
      : typeof rawColumns === "string"
      ? [rawColumns]
      : [];

    await framework.endpoints.schema.create({
      action: "create",
      tableName,
      columns: columns,
    });

    const schema = await framework.endpoints.schema.get();
    return c.html(<SchemaView schema={schema} />);
  });

  // Data routes
  app.get("/data", async (c) => {
    const schema = await framework.endpoints.schema.get();
    const tables = Object.keys(schema);
    const currentTable = c.req.query("table");

    let data: any[] = [];
    if (currentTable) {
      data = await framework.endpoints.data.query(currentTable, {});
    }

    return c.html(
      <Layout title="Data">
        <DataView tables={tables} currentTable={currentTable} data={data} />
      </Layout>
    );
  });

  // Data mutations
  app.post("/data/:table", async (c) => {
    const tableName = c.req.param("table");
    const data = await c.req.json();

    const result = await framework.endpoints.data.create({
      tableName,
      data,
    });

    return c.json(result);
  });

  app.put("/data/:table/:id", async (c) => {
    const tableName = c.req.param("table");
    const id = c.req.param("id");
    const data = await c.req.json();

    const result = await framework.endpoints.data.update({
      tableName,
      id,
      data,
    });

    return c.json(result);
  });

  app.delete("/data/:table/:id", async (c) => {
    const tableName = c.req.param("table");
    const id = c.req.param("id");

    const result = await framework.endpoints.data.delete({
      tableName,
      id,
      data: {},
    });

    return c.json(result);
  });

  // Permissions routes
  app.get("/permissions", async (c) => {
    const schema = await framework.endpoints.schema.get();
    const tables = Object.keys(schema);
    const currentTable = c.req.query("table");

    let permissions;
    if (currentTable) {
      permissions = await framework.endpoints.permissions.get({
        tableName: currentTable,
      });
    }

    return c.html(
      <Layout title="Permissions">
        <PermissionsView
          tables={tables}
          currentTable={currentTable}
          permissions={permissions}
        />
      </Layout>
    );
  });

  // Permission mutations
  app.post("/permissions/:table", async (c) => {
    const tableName = c.req.param("table");
    const permissions = await c.req.json();

    await framework.endpoints.permissions.set({
      tableName,
      permissions,
    });

    return c.json({ success: true });
  });

  return app;
};
