export type PermissionRule = {
  allow:
    | "public"
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
};

export type TablePermissions = {
  operations: {
    SELECT?: PermissionRule[];
    INSERT?: PermissionRule[];
    UPDATE?: PermissionRule[];
    DELETE?: PermissionRule[];
  };
};
