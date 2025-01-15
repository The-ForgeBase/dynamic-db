import type { Knex } from "knex";
import { PermissionService } from "./database/permissionService.js";
import { enforcePermissions } from "./database/rlsManager.js";
import { DBInspector, type DatabaseSchema } from "./database/inspector.js";
import KnexHooks from "./database/knex-hooks.js";
import type {
  DataMutationParams,
  DataQueryParams,
  FrameworkConfig,
  FrameworkEndpoints,
  ModifySchemaParams,
  PermissionParams,
  SchemaCreateParams,
  TablePermissions,
} from "./types.js";
import type { UserContext } from "./types.js";
import { createColumn } from "./database/column-utils.js";
import { modifySchema } from "./database/schema.js";
import { QueryHandler } from "./database/sdk/server.js";

export class Framework {
  private queryHandler: QueryHandler;
  private hooks: KnexHooks;
  private permissionService: PermissionService;
  private dbInspector: DBInspector;
  private validTables: string[] = [];
  private defaultPermissions: TablePermissions = {
    operations: {
      SELECT: [
        {
          allow: "public",
        },
      ],
      INSERT: [
        {
          allow: "public",
        },
      ],
      UPDATE: [
        {
          allow: "public",
        },
      ],
      DELETE: [
        {
          allow: "public",
        },
      ],
    },
  };

  constructor(private config: FrameworkConfig = {}) {
    if (!config.db) throw new Error("Database instance is required");

    this.hooks = config.hooks || new KnexHooks(config.db);
    this.queryHandler = new QueryHandler(this.hooks.getKnexInstance());
    this.permissionService =
      config.permissions || new PermissionService(config.db);
    this.dbInspector = new DBInspector(config.db);

    // Setup real-time listeners if enabled
    if (config.realtime) {
      this.hooks.on("beforeQuery", ({ tableName, context }) => {
        console.log(`[Real-Time Event] Query on ${tableName}:`, context);
      });
    }

    // Set default permissions for all tables
    if (config.defaultPermissions) {
      this.defaultPermissions = config.defaultPermissions;
    }

    // Set valid tables if provided
    if (config.validTables) {
      this.validTables = config.validTables;
    }
  }

  private validateTable(tableName: string): void {
    if (
      this.config.checkValidTable &&
      this.validTables.length &&
      !this.validTables.includes(tableName)
    ) {
      throw new Error("Invalid table name");
    }
  }

  public getEndpoints() {
    return this.endpoints;
  }

  public getKnexInstance(): Knex {
    return this.hooks.getKnexInstance();
  }

  public endpoints: FrameworkEndpoints = {
    schema: {
      get: async (): Promise<DatabaseSchema> => {
        try {
          return await this.dbInspector.getDatabaseSchema();
        } catch (error: any) {
          throw new Error(error);
        }
      },
      create: async (payload: SchemaCreateParams) => {
        try {
          const { tableName, columns } = payload;

          if (!tableName) {
            throw new Error("Invalid request body");
          }

            await this.hooks
              .getKnexInstance()
              .schema.createTableIfNotExists(tableName, (table) => {
                columns.forEach((col: any) => createColumn(table, col));
              });

            this.permissionService.setPermissionsForTable(
              tableName,
              this.defaultPermissions
            );
            return {
              message: "Table created successfully",
              tablename: tableName,
              action: 'create',
            };

        } catch (error: any) {
          throw new Error(error);
        }
      },
      delete: async (tableName: string) => {
        try {
          await this.hooks
              .getKnexInstance()
              .schema.dropTableIfExists(tableName);

            await this.permissionService.deletePermissionsForTable(tableName)

            return {
              message: "Table deleted successfully",
              tablename: tableName,
              action: 'delete',
            };
        } catch(error: any) {
           throw new Error(error)
        }
      },
      modify: async (payload: ModifySchemaParams) => {
        try {          
          return await modifySchema(this.hooks.getKnexInstance(), payload);
        } catch (error: any) {
          throw new Error(error);
        }
      },

    },

    data: {
      query: async (
        tableName: string,
        params: DataQueryParams,
        user?: UserContext
      ) => {
        try {
          this.validateTable(tableName);
          const queryParams = this.parseQueryParams(params);

          const records = await this.hooks.query(
            tableName,
            (query) => this.queryHandler.buildQuery(queryParams, query),
            queryParams
          );

          if (this.config.enforceRls && user) {
            return enforcePermissions(tableName, "SELECT", records, user);
          }

          return records as any;
        } catch (error: any) {
          throw new Error(error);
        }
      },

      create: async (params: DataMutationParams, user?: UserContext) => {
        try {
          const { data, tableName } = params;

          this.validateTable(tableName);

          // Handle both single record and array of records
          const isArray = Array.isArray(data);
          const records = isArray ? data : [data];

          // Validate records
          if (
            !records.length ||
            !records.every(
              (record) =>
                typeof record === "object" && Object.keys(record).length > 0
            )
          ) {
            throw new Error("Invalid request body");
          }

          if (this.config.enforceRls && user) {
            return enforcePermissions(tableName, "INSERT", records, user);
          }

          const result = this.hooks.mutate(
            tableName,
            "create",
            async (query) => query.insert(records).returning("id"),
            records
          );

          return result;
        } catch (error: any) {
          throw new Error(error);
        }
      },

      update: async (params: DataMutationParams, user?: UserContext) => {
        try {
          const { id, tableName, data } = params;
          this.validateTable(tableName);

          if (this.config.enforceRls && user) {
            return enforcePermissions(tableName, "UPDATE", data, user);
          }

          const result = this.hooks.mutate(
            tableName,
            "update",
            async (query) => query.where({ id }).update(data),

            { id, ...data }
          );

          return result;
        } catch (error: any) {
          throw new Error(error);
        }
      },

      delete: async (params: DataMutationParams, user?: UserContext) => {
        try {
          const { id, tableName } = params;
          this.validateTable(tableName);

          // get the record to enforce permissions
          const record = await this.hooks.query(
            tableName,
            (query) => {
              return query.where({ id });
            },
            { id }
          );

          if (this.config.enforceRls && user) {
            return enforcePermissions(tableName, "DELETE", record, user);
          }

          return this.hooks.mutate(
            tableName,
            "delete",
            async (query) => query.where({ id }).delete(),
            { id }
          );
        } catch (error: any) {
          throw new Error(error);
        }
      },
    },

    permissions: {
      get: async (params: PermissionParams) => {
        try {
          const { tableName } = params;
          return this.permissionService.getPermissionsForTable(tableName);
        } catch (error: any) {
          throw new Error(error);
        }
      },

      set: async (params: PermissionParams) => {
        try {
          const { tableName, permissions } = params;

          if (!permissions) {
            throw new Error("Permissions object is required");
          }

          return this.permissionService.setPermissionsForTable(
            tableName,
            permissions
          );
        } catch (error: any) {
          throw new Error(error);
        }
      },
    },
  };

  private parseQueryParams(params: Record<string, any>): Record<string, any> {
    const queryParams: Record<string, any> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string") {
        try {
          queryParams[key] = JSON.parse(value);
        } catch {
          if (key === "limit" || key === "offset") {
            queryParams[key] = parseInt(value, 10) || 10;
          } else {
            queryParams[key] = value;
          }
        }
      } else {
        queryParams[key] = value;
      }
    });

    return queryParams;
  }
}

// Export factory function
export const createFramework = (config: FrameworkConfig) => {
  return new Framework(config);
};

// Export types
export * from "./types.js";
