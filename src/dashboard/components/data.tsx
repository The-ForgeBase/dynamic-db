interface DataViewProps {
  tables: string[];
  currentTable?: string;
  data?: any[];
}

export const DataView = ({ tables, currentTable, data }: DataViewProps) => (
  <div>
    <div class="flex justify-between mb-6">
      <h1 class="text-2xl font-bold">Table Data</h1>
      <select
        class="border rounded px-3 py-1"
        hx-get="/dashboard/data"
        hx-target="#dataContent"
        name="table"
      >
        <option value="">Select Table</option>
        {tables.map((table) => (
          <option value={table} selected={table === currentTable}>
            {table}
          </option>
        ))}
      </select>
    </div>

    <div id="dataContent" class="bg-white rounded shadow">
      {currentTable && data && (
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left border-b">
                {Object.keys(data[0] || {}).map((key) => (
                  <th class="p-3">{key}</th>
                ))}
                <th class="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr class="border-b">
                  {Object.values(row).map((value) => (
                    <td class="p-3">{String(value)}</td>
                  ))}
                  <td class="p-3">
                    <button
                      class="text-blue-500 mr-2"
                      hx-get={`/dashboard/data/${currentTable}/${row.id}/edit`}
                      hx-target="closest tr"
                    >
                      Edit
                    </button>
                    <button
                      class="text-red-500"
                      hx-delete={`/dashboard/data/${currentTable}/${row.id}`}
                      hx-confirm="Are you sure?"
                      hx-target="closest tr"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);
