import type { DatabaseSchema } from "../../framework/inspector.js";

interface SchemaViewProps {
  schema: DatabaseSchema;
}

const getDataTypeDisplay = (column: any) => {
  let type = column.data_type.toUpperCase();
  if (column.max_length) {
    type += `(${column.max_length})`;
  }
  return type;
};

const getBadges = (column: any) => {
  const badges = [];
  if (column.is_primary_key) badges.push("PRIMARY");
  if (column.is_unique) badges.push("UNIQUE");
  if (column.has_auto_increment) badges.push("AUTO_INCREMENT");
  if (!column.is_nullable) badges.push("NOT NULL");
  return badges;
};

export const SchemaView = ({ schema }: SchemaViewProps) => (
  <div>
    <div class="flex justify-between mb-6">
      <h1 class="text-2xl font-bold">Database Schema</h1>
      <button
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        hx-get="/dashboard/schema/new"
        hx-target="#schemaContent"
      >
        Create Table
      </button>
    </div>

    <div id="schemaContent" class="space-y-6">
      {Object.entries(schema).map(([tableName, table]) => (
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h2 class="text-xl font-semibold text-gray-800">{tableName}</h2>
              <p class="text-sm text-gray-500">
                {table.columns.length} columns
              </p>
            </div>
            <div class="space-x-2">
              <button
                class="text-blue-500 hover:text-blue-600"
                hx-get={`/dashboard/schema/${tableName}/edit`}
                hx-target="#schemaContent"
              >
                Edit
              </button>
              <button
                class="text-red-500 hover:text-red-600"
                hx-delete={`/dashboard/schema/${tableName}`}
                hx-confirm="Are you sure you want to delete this table?"
                hx-target="#schemaContent"
              >
                Delete
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left border-b">
                  <th class="pb-2 pr-4 font-medium text-gray-600">Column</th>
                  <th class="pb-2 pr-4 font-medium text-gray-600">Type</th>
                  <th class="pb-2 pr-4 font-medium text-gray-600">
                    Attributes
                  </th>
                  <th class="pb-2 pr-4 font-medium text-gray-600">Default</th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((column: any) => (
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-4">
                      <span class="font-medium">{column.name}</span>
                    </td>
                    <td class="py-2 pr-4">
                      <code class="bg-gray-100 px-2 py-1 rounded text-sm">
                        {getDataTypeDisplay(column)}
                      </code>
                    </td>
                    <td class="py-2 pr-4">
                      <div class="flex gap-1 flex-wrap">
                        {getBadges(column).map((badge) => (
                          <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td class="py-2 pr-4">
                      <code class="text-sm text-gray-600">
                        {column.default_value || "NULL"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {table.foreignKeys.length > 0 && (
            <div class="mt-4">
              <h3 class="text-sm font-medium text-gray-600 mb-2">
                Foreign Keys
              </h3>
              <div class="space-y-1">
                {table.foreignKeys.map((fk: any) => (
                  <div class="text-sm text-gray-600">
                    {fk.column} → {fk.foreign_table}.{fk.foreign_column}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);
