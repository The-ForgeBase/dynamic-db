import type { TablePermissions } from "../../framework/types.js";

interface PermissionsViewProps {
  tables: string[];
  currentTable?: string;
  permissions?: TablePermissions;
}

const OperationBadge = ({ type }: { type: string }) => {
  const colors: any = {
    SELECT: "bg-blue-100 text-blue-800",
    INSERT: "bg-green-100 text-green-800",
    UPDATE: "bg-yellow-100 text-yellow-800",
    DELETE: "bg-red-100 text-red-800",
  };

  return (
    <span class={`px-2 py-1 rounded text-xs font-medium ${colors[type] || ""}`}>
      {type}
    </span>
  );
};

export const PermissionsView = ({
  tables,
  currentTable,
  permissions,
}: PermissionsViewProps) => (
  <div>
    <div class="flex justify-between mb-6">
      <h1 class="text-2xl font-bold">Table Permissions</h1>
      <select
        class="border rounded px-3 py-1"
        hx-get="/dashboard/permissions"
        hx-target="#permissionsContent"
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

    <div id="permissionsContent" class="space-y-6">
      {currentTable && permissions && (
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="mb-4 flex justify-between items-center">
            <h2 class="text-xl font-semibold">
              Permissions for {currentTable}
            </h2>
            <button
              class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              hx-get={`/dashboard/permissions/${currentTable}/edit`}
              hx-target="#permissionsContent"
            >
              Edit Permissions
            </button>
          </div>

          <div class="space-y-4">
            {Object.entries(permissions.operations).map(([op, rules]) => (
              <div class="border-b pb-4">
                <div class="flex items-center mb-2">
                  <OperationBadge type={op} />
                </div>
                <div class="space-y-2">
                  {rules.map((rule) => (
                    <div class="pl-4 text-sm">
                      <span class="font-medium">Allow:</span> {rule.allow}
                      {rule.roles && (
                        <div class="ml-4">
                          <span class="font-medium">Roles:</span>{" "}
                          {rule.roles.join(", ")}
                        </div>
                      )}
                      {rule.teams && (
                        <div class="ml-4">
                          <span class="font-medium">Teams:</span>{" "}
                          {rule.teams.join(", ")}
                        </div>
                      )}
                      {rule.labels && (
                        <div class="ml-4">
                          <span class="font-medium">Labels:</span>{" "}
                          {rule.labels.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);
