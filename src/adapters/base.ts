import type { Knex } from "knex";
import type { WindowFunction, OrderByClause } from "../sdk/server.js";

export interface DatabaseAdapter {
  buildWindowFunction(wf: WindowFunction): string;
  buildOrderByClause(
    clauses: OrderByClause[],
    knex?: Knex
  ): { column: string; order: "asc" | "desc"; null?: "first" | "last" }[];
  supportsFeature(feature: DatabaseFeature): boolean;
  sanitizeIdentifier(identifier: string): string;
}

export enum DatabaseFeature {
  WindowFunctions = "windowFunctions",
  CTEs = "ctes",
  RecursiveCTEs = "recursiveCTEs",
  NullsOrdering = "nullsOrdering",
  JsonOperations = "jsonOperations",
  ArrayOperations = "arrayOperations",
}
