import type { Knex } from "knex";
import type { TablePermissions } from "./types.js";

class PermissionService {
  constructor(private knex: Knex) {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    const hasTable = await this.knex.schema.hasTable("table_permissions");
    if (!hasTable) {
      await this.knex.schema.createTable("table_permissions", (table) => {
        table.string("table_name").primary().unique().notNullable();
        table.json("permissions").notNullable();
        table.timestamps(true, true);
      });
    }
  }

  async getPermissionsForTable(
    tableName: string
  ): Promise<TablePermissions | undefined> {
    const result = await this.knex("table_permissions")
      .where({ table_name: tableName })
      .first();

    if (!result) return undefined;
    return JSON.parse(result.permissions);
  }

  async setPermissionsForTable(
    tableName: string,
    permissions: TablePermissions
  ): Promise<void> {
    await this.knex("table_permissions")
      .insert({
        table_name: tableName,
        permissions: JSON.stringify(permissions),
      })
      .onConflict("table_name")
      .merge();
  }

  async deletePermissionsForTable(tableName: string): Promise<void> {
    await this.knex("table_permissions")
      .where({ table_name: tableName })
      .delete();
  }
}

// Don't export the instance directly, we'll initialize it in index.ts
export { PermissionService };
