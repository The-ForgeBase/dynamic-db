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

export interface UpdateColumnDefinition {
  currentName: string;
  newName?: string;
  type?: ColumnType;
  currentType: ColumnType; // Added this to know the current column type
  primary?: boolean;
  unique?: boolean;
  nullable?: boolean;
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
