import type { Knex } from "knex";
import type { ColumnDefinition, ForeignKey } from "./types.js";

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
