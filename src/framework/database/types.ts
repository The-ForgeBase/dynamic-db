// Column definition for schema operations
export type ColumnType =
  | "increments"
  | "string"
  | "text"
  | "integer"
  | "bigInteger"
  | "boolean"
  | "decimal"
  | "float"
  | "datetime"
  | "date"
  | "time"
  | "timestamp"
  | "binary"
  | "json"
  | "uuid";

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  primary?: boolean;
  unique?: boolean;
  nullable: boolean;
  foreignKeys?: ForeignKey[];
  default?: any;
}

export interface ForeignKey {
  columnName: string;
  references: {
    tableName: string;
    columnName: string;
  };
}

// Schema operation types
export interface SchemaOperation {
  action: "create" | "delete" | "alter";
  tableName: string;
  columns?: ColumnDefinition[];
}
