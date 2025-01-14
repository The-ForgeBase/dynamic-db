import type { Knex } from "knex";
import type KnexHooks from "./knex-hooks.js";
import type { PermissionService } from "./permissionService.js";

export type PermissionRule = {
  allow:
    | "public"
    | "private"
    | "role"
    | "auth"
    | "guest"
    | "labels"
    | "teams"
    | "static"
    | "fieldCheck"
    | "customSql";
  labels?: string[]; // Array of required labels
  teams?: string[]; // Array of required teams
  static?: boolean; // Static true/false value
  customSql?: string; // Custom SQL condition (full SQL)
  fieldCheck?: FieldCheck; // Field-based rules
  roles?: string[];
};

export type UserContextFields = keyof UserContext;

export type FieldCheck = {
  field: string; // Field to check on the row/data being fetched or mutated
  operator: "===" | "!==" | "in" | "notIn"; // Comparison operators
  valueType: "userContext" | "static"; // Whether to compare against userContext or a static value
  value: UserContextFields | any[]; // Updated to use UserContextFields when valueType is "userContext"
};

export type UserContext = {
  userId: number | string;
  labels: string[];
  teams: string[];
  permissions?: string[]; // Optional explicit permissions
  role?: string;
};

export type TablePermissions = {
  operations: {
    SELECT?: PermissionRule[];
    INSERT?: PermissionRule[];
    UPDATE?: PermissionRule[];
    DELETE?: PermissionRule[];
  };
};

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

// Handler types
export type EndpointHandler = (request: Request) => Promise<any>;
export type SchemaHandler = (request: Request) => Promise<any>;
export type PermissionHandler = (request: Request) => Promise<any>;
export type DataHandler = (request: Request) => Promise<any>;

// Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status?: number;
}
