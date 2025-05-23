import { SchemaInspector } from "knex-schema-inspector";
import { default as schemaInspectorImport } from "knex-schema-inspector";
const schemaInspector = schemaInspectorImport.default;
import type { Knex } from "knex";

interface TableInfo {
  columns: any;
  foreignKeys: any;
  //indexes: any;
}

export interface DatabaseSchema {
  [tableName: string]: TableInfo;
}

export class DBInspector {
  private inspector: ReturnType<typeof SchemaInspector>;

  constructor(knex: Knex) {
    this.inspector = schemaInspector(knex);
  }

  async getTables(): Promise<string[]> {
    return await this.inspector.tables();
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    const columns = await this.inspector.columnInfo(tableName);
    const foreignKeys = await this.inspector.foreignKeys(tableName);
    // const indexes = await this.inspector.ta(tableName);

    return {
      columns,
      foreignKeys,
      //indexes,
    };
  }

  async getDatabaseSchema(): Promise<DatabaseSchema> {
    const tables = await this.getTables();
    const schema: DatabaseSchema = {};

    for (const table of tables) {
      schema[table] = await this.getTableInfo(table);
    }

    return schema;
  }
}
