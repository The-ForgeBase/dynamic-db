import type { Knex } from "knex";
import type KnexHooks from "../hookableDb.js";
import type { PermissionService } from "../permissionService.js";
import type { TablePermissions } from "../types.js";

export interface FrameworkConfig {
  db?: Knex;
  hooks?: KnexHooks;
  permissions?: PermissionService;
  prefix?: string;
  enforceRls?: boolean;
  realtime?: boolean;
  defaultPermissions?: TablePermissions;
  validTables?: string[];
  checkValidTable?: boolean;
}

// Re-export types from core services
export type { TablePermissions };

// Handler types
export type EndpointHandler = (request: Request) => Promise<any>;
export type SchemaHandler = (request: Request) => Promise<any>;
export type PermissionHandler = (request: Request) => Promise<any>;
export type DataHandler = (request: Request) => Promise<any>;

// Column definition for schema operations
export interface ColumnDefinition {
  name: string;
  type:
    | "increments"
    | "string"
    | "integer"
    | "boolean"
    | "decimal"
    | "timestamp"
    | "json";
  primary?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: any;
}

// Schema operation types
export interface SchemaOperation {
  action: "create" | "delete" | "alter";
  tableName: string;
  columns?: ColumnDefinition[];
}

// Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status?: number;
}
