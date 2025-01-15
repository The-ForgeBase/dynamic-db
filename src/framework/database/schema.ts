import { Knex } from 'knex';
import type { ModifySchemaParams, SchemaCreateParams } from '../types.js';
import { createColumn, updateColumn } from './column-utils.js';
import type { ColumnDefinition, UpdateColumnDefinition } from './types.js';

// export async function createTable(knex: Knex, params: SchemaCreateParams) {
//   const { tableName, action, columns } = params;

//   if(action !== 'create') {
//     throw new Error('Not a create action')
//   }
// }

export async function modifySchema(knex: Knex, params: ModifySchemaParams) {
  const { tableName, action, columns } = params;

  try {
    switch (action) {
      case 'addColumn':
        await knex.schema.alterTable(tableName, (table) => {
          columns.forEach((col: any) => createColumn(table, col));
        });
        break;

      case 'deleteColumn':
        await knex.schema.alterTable(tableName, (table) => {
          columns.forEach((col: any) => table.dropColumn(col.name))
        });
        break;

        case 'updateColumn':
          // Handle each column update sequentially
          for (const col of columns as UpdateColumnDefinition[]) {
            await updateColumn(knex, tableName, col);
          }
          break;
    }
  } catch (error) {
    console.error('Error modifying schema:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}