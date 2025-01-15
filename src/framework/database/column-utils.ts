import type { Knex } from "knex";
import type { ColumnDefinition, ForeignKey, UpdateColumnDefinition } from "./types.js";
import { default as schemaInspectorImport } from "knex-schema-inspector";
const schemaInspector = schemaInspectorImport.default;

export function createColumn(
  table: Knex.TableBuilder,
  columnDef: ColumnDefinition
) {
  let column;

  switch (columnDef.type) {
    case "increments":
      column = table.increments(columnDef.name);
      break;
    case "string":
      column = table.string(columnDef.name);
      break;
    case "text":
      column = table.text(columnDef.name);
      break;
    case "integer":
      column = table.integer(columnDef.name);
      break;
    case "bigInteger":
      column = table.bigInteger(columnDef.name);
      break;
    case "boolean":
      column = table.boolean(columnDef.name);
      break;
    case "decimal":
      column = table.decimal(columnDef.name);
      break;
    case "float":
      column = table.float(columnDef.name);
      break;
    case "datetime":
      column = table.datetime(columnDef.name);
      break;
    case "date":
      column = table.date(columnDef.name);
      break;
    case "time":
      column = table.time(columnDef.name);
      break;
    case "timestamp":
      column = table.timestamp(columnDef.name);
      break;
    case "binary":
      column = table.binary(columnDef.name);
      break;
    case "json":
      column = table.json(columnDef.name);
      break;
    case "uuid":
      column = table.uuid(columnDef.name);
      break;
    default:
      throw new Error(`Unsupported column type: ${columnDef.type}`);
  }

  // Apply modifiers
  if (columnDef.primary) column.primary();
  if (columnDef.unique) column.unique();
  if (columnDef.nullable === false) column.notNullable();
  if (columnDef.default !== undefined) column.defaultTo(columnDef.default);

  // Foregn key
  if (columnDef.foreignKeys) {
    const key = columnDef.foreignKeys as ForeignKey[];
    key.forEach(async (fk) => {
      table
        .foreign(fk.columnName)
        .references(fk.references.columnName)
        .inTable(fk.references.tableName);
    });
  }

  return column;
}

// Helper function to check for foreign keys
async function dropExistingForeignKeys(
  knex: Knex,
  tableName: string,
  columnName: string
) {
  const inspector = schemaInspector(knex);
  // Get foreign key constraints
  const foreignKeys = await inspector.foreignKeys(tableName);

    for (const fk of foreignKeys) {
      await knex.schema.alterTable(tableName, table => {
        table.dropForeign([fk.column]);
      });
    }

}



// Update column function using drop and recreate approach
export async function updateColumn(
  knex: Knex,
  tableName: string,
  columnDef: UpdateColumnDefinition
) {
  // First, check and drop any existing foreign keys
  await dropExistingForeignKeys(knex, tableName, columnDef.currentName);

  // Then do all modifications in a single alter table call
  await knex.schema.alterTable(tableName, table => {
    // Drop the existing column
    table.dropColumn(columnDef.currentName);

    // Recreate the column with new definition
    let column = createColumn(table, {
      name: columnDef.newName || columnDef.currentName,
      type: columnDef.type || columnDef.currentType,
      nullable: columnDef.nullable ?? true,
      primary: columnDef.primary,
      unique: columnDef.unique,
      foreignKeys: columnDef.foreignKeys,
      default: columnDef.default
    });

    return column
  });
}