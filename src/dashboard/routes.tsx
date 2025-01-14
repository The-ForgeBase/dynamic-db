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
    const schema = await framework.endpoints.schema.get(c.req.raw);
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
    const columns = Array.isArray(rawColumns)
      ? rawColumns
      : typeof rawColumns === "string"
      ? [rawColumns]
      : [];

    const formattedColumns = columns.map((col: any) => ({
      name: col.name || col,
      type: col.type || "string",
      primary: col.primary === "on",
      unique: col.unique === "on",
      notNullable: col.primary === "on",
    }));

    // Create request object for framework endpoint
    const createRequest = new Request("http://localhost/schema", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create",
        tableName,
        columns: formattedColumns,
      }),
    });

    await framework.endpoints.schema.create(createRequest);

    const schema = await framework.endpoints.schema.get(c.req.raw);
    return c.html(<SchemaView schema={schema} />);
  });

  // Data routes
  app.get("/data", async (c) => {
    const schema = await framework.endpoints.schema.get(c.req.raw);
    const tables = Object.keys(schema);
    const currentTable = c.req.query("table");

    let data: any[] = [];
    if (currentTable) {
      const url = new URL(c.req.url);
      url.pathname = `/api/data/${currentTable}`;
      data = await framework.endpoints.data.query(new Request(url));
    }

    return c.html(
      <Layout title="Data">
        <DataView tables={tables} currentTable={currentTable} data={data} />
      </Layout>
    );
  });

  // Permissions routes
  app.get("/permissions", async (c) => {
    const schema = await framework.endpoints.schema.get(c.req.raw);
    const tables = Object.keys(schema);
    const currentTable = c.req.query("table");

    let permissions;
    if (currentTable) {
      const url = new URL(c.req.url);
      url.pathname = `/api/permissions/${currentTable}`;
      permissions = await framework.endpoints.permissions.get(new Request(url));
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

  return app;
};
