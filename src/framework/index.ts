import type { Knex } from "knex";
import { PermissionService } from "./permissionService.js";
import { enforcePermissions } from "./rlsManager.js";
import { QueryHandler } from "../sdk/server.js";
import { DBInspector, type DatabaseSchema } from "./inspector.js";
import KnexHooks from "./knex-hooks.js";
import type { FrameworkConfig, TablePermissions } from "./types.js";
import type { UserContext } from "./types.js";
import { createColumn } from "./database/column-utils.js";

// Define the endpoints interface first
export interface FrameworkEndpoints {
  schema: {
    get: (request: Request) => Promise<DatabaseSchema>;
    create: (request: Request) => Promise<{
      message: string;
      tablename: string;
      action: string;
    }>;
  };
  data: {
    query: <T>(request: Request, user?: UserContext) => Promise<T[]>;
    create: (request: Request, user?: UserContext) => Promise<string[]>;
    update: (request: Request, user?: UserContext) => Promise<void>;
    delete: (request: Request, user?: UserContext) => Promise<void>;
  };
  permissions: {
    get: (request: Request) => Promise<TablePermissions | undefined>;
    set: (request: Request) => Promise<void>;
  };
}

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

  private wrapHandler<T>(handler: Function) {
    return async (request: Request): Promise<T> => {
      try {
        return await handler(request);
      } catch (err: any) {
        throw new Error(err);
      }
    };
  }

  public getEndpoints() {
    return this.endpoints;
  }

  public getKnexInstance(): Knex {
    return this.hooks.getKnexInstance();
  }

  public endpoints: FrameworkEndpoints = {
    schema: {
      get: this.wrapHandler<DatabaseSchema>(
        async (request: Request): Promise<DatabaseSchema> => {
          try {
            return await this.dbInspector.getDatabaseSchema();
          } catch (error: any) {
            throw new Error(error);
          }
        }
      ),

      create: this.wrapHandler<{
        message: string;
        tablename: string;
        action: string;
      }>(async (request: Request) => {
        try {
          const payload = await request.json();
          const { action, tableName, columns } = payload;

          if (!action || !tableName) {
            throw new Error("Invalid request body");
          }

          if (action === "create") {
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
              action,
            };
          } else if (action === "delete") {
            await this.hooks
              .getKnexInstance()
              .schema.dropTableIfExists(tableName);

            return {
              message: "Table deleted successfully",
              tablename: tableName,
              action,
            };
          }

          throw new Error("Invalid action");
        } catch (error: any) {
          throw new Error(error);
        }
      }),
    },

    data: {
      query: this.wrapHandler<any[]>(
        async (request: Request, user?: UserContext) => {
          try {
            const url = new URL(request.url);
            const tableName = url.pathname.split("/").pop()!;
            this.validateTable(tableName);

            const params = Object.fromEntries(url.searchParams);
            const queryParams = this.parseQueryParams(params);

            const records = await this.hooks.query(
              tableName,
              (query) => this.queryHandler.buildQuery(queryParams, query),
              queryParams
            );

            if (this.config.enforceRls && user) {
              return enforcePermissions(tableName, "SELECT", records, user);
            }

            return records;
          } catch (error: any) {
            throw new Error(error);
          }
        }
      ) as <T>(request: Request, user?: UserContext) => Promise<T[]>,

      create: this.wrapHandler<string[]>(
        async (request: Request, user?: UserContext) => {
          try {
            const url = new URL(request.url);
            const table = url.pathname.split("/").pop()!;
            const { data } = await request.json();

            this.validateTable(table);

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
              return enforcePermissions(table, "INSERT", records, user);
            }

            const result = this.hooks.mutate(
              table,
              "create",
              async (query) => query.insert(records).returning("id"),
              records
            );

            return result;
          } catch (error: any) {
            throw new Error(error);
          }
        }
      ),

      update: this.wrapHandler(async (request: Request, user?: UserContext) => {
        try {
          const url = new URL(request.url);
          const [table, id] = url.pathname.split("/").slice(-2);
          const { data } = await request.json();
          this.validateTable(table);

          if (this.config.enforceRls && user) {
            return enforcePermissions(table, "UPDATE", data, user);
          }

          const result = this.hooks.mutate(
            table,
            "update",
            async (query) => query.where({ id }).update(data),

            { id, ...data }
          );
        } catch (error: any) {
          throw new Error(error);
        }
      }),

      delete: this.wrapHandler(async (request: Request, user?: UserContext) => {
        try {
          const url = new URL(request.url);
          const [table, id] = url.pathname.split("/").slice(-2);
          this.validateTable(table);

          // get the record to enforce permissions
          const record = await this.hooks.query(
            table,
            (query) => {
              return query.where({ id });
            },
            { id }
          );

          if (this.config.enforceRls && user) {
            return enforcePermissions(table, "DELETE", record, user);
          }

          return this.hooks.mutate(
            table,
            "delete",
            async (query) => query.where({ id }).delete(),
            { id }
          );
        } catch (error: any) {
          throw new Error(error);
        }
      }),
    },

    permissions: {
      get: this.wrapHandler<TablePermissions | undefined>(
        async (request: Request) => {
          try {
            const url = new URL(request.url);
            const table = url.pathname.split("/").pop()!;
            return this.permissionService.getPermissionsForTable(table);
          } catch (error: any) {
            throw new Error(error);
          }
        }
      ),

      set: this.wrapHandler(async (request: Request) => {
        try {
          const url = new URL(request.url);
          const table = url.pathname.split("/").pop()!;
          const permissions = await request.json();
          return this.permissionService.setPermissionsForTable(
            table,
            permissions
          );
        } catch (error: any) {
          throw new Error(error);
        }
      }),
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
