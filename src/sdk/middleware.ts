import type knex from "knex";
import Redis from "ioredis";
import type { ExplainOptions, QueryParams, QueryValidation } from "./client.js";

interface CacheConfig {
  ttl: number;
  key?: string;
  tags?: string[];
  condition?: (params: QueryParams) => boolean;
}

class QueryMiddleware {
  private redis: Redis;

  constructor(
    private knex: knex.Knex,
    redisConfig: { host: string; port: number }
  ) {
    this.redis = new Redis(redisConfig);
  }

  /**
   * Wraps query execution with caching, validation, and optimization
   */
  async executeQuery(
    params: QueryParams & {
      cache?: CacheConfig;
      validation?: QueryValidation;
      explain?: ExplainOptions;
    },
    queryBuilder: knex.Knex.QueryBuilder
  ) {
    // Step 1: Validate the query
    if (params.validation) {
      const violations = await this.validateQuery(params);
      if (violations.length > 0) {
        throw new Error(`Query validation failed: ${violations.join(", ")}`);
      }
    }

    // Step 2: Check cache
    if (params.cache) {
      const cachedResult = await this.getCachedResult(params);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Step 3: Get optimization suggestions
    if (params.validation?.suggestions) {
      const suggestions = await this.getOptimizationSuggestions(
        params,
        queryBuilder
      );
      if (suggestions.length > 0) {
        console.warn("Query optimization suggestions:", suggestions);
      }
    }

    // Step 4: Execute query and handle explain
    let result;
    if (params.explain) {
      result = await this.explainQuery(queryBuilder, params.explain);
    } else {
      result = await queryBuilder;
    }

    // Step 5: Cache results if needed
    if (params.cache) {
      await this.cacheResult(params, result);
    }

    return result;
  }

  /**
   * Validates the query against defined rules
   */
  private async validateQuery(params: QueryParams): Promise<string[]> {
    const violations: string[] = [];
    const rules = params.validation?.rules;

    if (!rules) return violations;

    // Check max limit
    if (rules.maxLimit && params.limit && params.limit > rules.maxLimit) {
      violations.push(
        `Limit exceeds maximum allowed value of ${rules.maxLimit}`
      );
    }

    // Check required fields
    if (rules.requiredFields) {
      const missingFields = rules.requiredFields.filter(
        (field: any) => !this.hasField(params, field)
      );
      if (missingFields.length > 0) {
        violations.push(`Missing required fields: ${missingFields.join(", ")}`);
      }
    }

    // Check disallowed fields
    if (rules.disallowedFields) {
      const presentDisallowedFields = rules.disallowedFields.filter(
        (field: any) => this.hasField(params, field)
      );
      if (presentDisallowedFields.length > 0) {
        violations.push(
          `Query contains disallowed fields: ${presentDisallowedFields.join(
            ", "
          )}`
        );
      }
    }

    // Check query complexity
    if (rules.maxComplexity) {
      const complexity = this.calculateQueryComplexity(params);
      if (complexity > rules.maxComplexity) {
        violations.push(
          `Query complexity (${complexity}) exceeds maximum allowed value (${rules.maxComplexity})`
        );
      }
    }

    return violations;
  }

  /**
   * Analyzes query for optimization opportunities
   */
  private async getOptimizationSuggestions(
    params: QueryParams,
    queryBuilder: knex.Knex.QueryBuilder
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Check explain plan for table scans
    const explainPlan = await queryBuilder.explain();
    if (this.containsTableScan(explainPlan)) {
      suggestions.push(
        "Query contains table scans. Consider adding indexes for: " +
          this.getUnindexedFields(params).join(", ")
      );
    }

    // Check for inefficient joins
    if (this.hasIneffientJoins(params)) {
      suggestions.push(
        "Query contains potentially inefficient joins. Consider denormalization or adding appropriate indexes."
      );
    }

    // Check for missing WHERE clauses on large tables
    if (await this.isLargeTableWithoutWhere(params)) {
      suggestions.push(
        "Query on large table without WHERE clause. Consider adding filters."
      );
    }

    // Check for proper use of indexes in ORDER BY
    if (await this.hasIneffientSorting(params)) {
      suggestions.push(
        "Inefficient sorting detected. Consider adding indexes for ORDER BY fields."
      );
    }

    return suggestions;
  }

  /**
   * Handles query explanation
   */
  private async explainQuery(
    queryBuilder: knex.Knex.QueryBuilder,
    options: ExplainOptions
  ) {
    const format = options.format || "json";
    let explainQuery = queryBuilder.explain();

    if (options.analyze) {
      explainQuery = explainQuery.analyze();
    }

    if (options.verbose) {
      explainQuery = explainQuery.verbose();
    }

    if (format === "json") {
      return explainQuery.format("json");
    }

    return explainQuery;
  }

  /**
   * Cache management methods
   */
  private async getCachedResult(params: QueryParams): Promise<any | null> {
    const cacheConfig = params.cache;
    if (!cacheConfig) return null;

    const cacheKey = this.generateCacheKey(params);
    const cachedData = await this.redis.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    return null;
  }

  private async cacheResult(params: QueryParams, result: any): Promise<void> {
    const cacheConfig = params.cache;
    if (!cacheConfig) return;

    const cacheKey = this.generateCacheKey(params);
    const shouldCache = cacheConfig.condition?.(params) ?? true;

    if (shouldCache) {
      await this.redis.setex(cacheKey, cacheConfig.ttl, JSON.stringify(result));

      if (cacheConfig.tags?.length) {
        await this.addCacheTags(cacheKey, cacheConfig.tags);
      }
    }
  }

  private async addCacheTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key);
    }
  }

  async invalidateCacheTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(`tag:${tag}`);
      }
    }
  }

  /**
   * Helper methods
   */
  private generateCacheKey(params: QueryParams): string {
    const cacheConfig = params.cache;
    if (cacheConfig?.key) {
      return `query:${cacheConfig.key}`;
    }
    return `query:${JSON.stringify(params)}`;
  }

  private hasField(params: QueryParams, field: string): boolean {
    return !!(
      params.filter?.[field] ||
      params.whereRaw?.some((w: any) => w.field === field) ||
      params.whereBetween?.some((w: any) => w.field === field) ||
      params.whereIn?.[field] ||
      params.whereNotIn?.[field] ||
      params.whereNull?.includes(field) ||
      params.whereNotNull?.includes(field)
    );
  }

  private calculateQueryComplexity(params: QueryParams): number {
    let complexity = 0;

    // Base complexity for each type of clause
    complexity += (params.whereRaw?.length || 0) * 1;
    complexity += (params.whereBetween?.length || 0) * 1.5;
    complexity += Object.keys(params.whereIn || {}).length * 2;
    complexity += (params.whereExists?.length || 0) * 3;
    complexity += (params.groupBy?.length || 0) * 2;
    complexity += (params.having?.length || 0) * 2;
    complexity += (params.windowFunctions?.length || 0) * 3;

    // Additional complexity for nested queries
    if (params.whereGroups) {
      complexity += this.calculateNestedComplexity(params.whereGroups);
    }

    return complexity;
  }

  private calculateNestedComplexity(groups: any[]): number {
    let complexity = 0;
    for (const group of groups) {
      complexity += (group.clauses?.length || 0) * 1.5;
      if (group.clauses?.some((c: any) => c.clauses)) {
        complexity += this.calculateNestedComplexity(
          group.clauses.filter((c: any) => c.clauses)
        );
      }
    }
    return complexity;
  }

  private async isLargeTableWithoutWhere(
    params: QueryParams
  ): Promise<boolean> {
    // Implementation to check table size and where clauses
    return false;
  }

  private hasIneffientJoins(params: QueryParams): boolean {
    // Implementation to check join efficiency
    return false;
  }

  private containsTableScan(explainPlan: any): boolean {
    // Implementation to analyze explain plan for table scans
    return false;
  }

  private getUnindexedFields(params: QueryParams): string[] {
    // Implementation to identify fields without indexes
    return [];
  }

  private async hasIneffientSorting(params: QueryParams): Promise<boolean> {
    // Implementation to check sorting efficiency
    return false;
  }
}

export { QueryMiddleware };

class QueryAnalyzer {
  constructor(private knex: knex.Knex) {}

  /**
   * Checks if a table is large and being queried without WHERE clauses
   */
  async isLargeTableWithoutWhere(params: QueryParams): Promise<boolean> {
    // Get table statistics
    const tableName = params.table;
    const stats = await this.knex.raw(
      `
        SELECT reltuples::bigint as estimate
        FROM pg_class
        WHERE relname = ?;
      `,
      [tableName]
    );

    const rowEstimate = stats.rows[0].estimate;
    const LARGE_TABLE_THRESHOLD = 100000; // 100k rows

    // Check if table is large and has no where clauses
    const hasWhereClause = !!(
      params.filter ||
      params.whereRaw?.length ||
      params.whereBetween?.length ||
      params.whereNull?.length ||
      params.whereGroups?.length
    );

    return rowEstimate > LARGE_TABLE_THRESHOLD && !hasWhereClause;
  }

  /**
   * Analyzes joins for inefficiencies
   */
  async hasIneffientJoins(params: QueryParams): Promise<boolean> {
    const explain = await this.getExplainPlan(params);

    // Look for problematic join patterns in explain plan
    const inefficientPatterns = [
      this.hasNestedLoops(explain),
      this.hasCartesianJoins(explain),
      this.hasMultipleJoinsOnUnindexedColumns(explain),
    ];

    return inefficientPatterns.some((pattern) => pattern);
  }

  /**
   * Detects table scans in the query plan
   */
  async containsTableScan(explainPlan: any): Promise<boolean> {
    const scanTypes = ["Seq Scan", "Full Table Scan"];

    const findScans = (node: any): boolean => {
      if (!node) return false;

      // Check current node
      if (scanTypes.some((scanType) => node["Node Type"]?.includes(scanType))) {
        return true;
      }

      // Check child nodes
      if (Array.isArray(node.Plans)) {
        return node.Plans.some((plan: any) => findScans(plan));
      }

      return false;
    };

    return findScans(explainPlan);
  }

  /**
   * Identifies fields without indexes that are used in the query
   */
  async getUnindexedFields(params: QueryParams): Promise<string[]> {
    const tableName = params.table;

    // Get all fields used in the query
    const usedFields = this.extractUsedFields(params);

    // Get existing indexes
    const indexes = await this.knex.raw(
      `
        SELECT a.attname
        FROM pg_class t,
             pg_class i,
             pg_index ix,
             pg_attribute a
        WHERE t.oid = ix.indrelid
          AND i.oid = ix.indexrelid
          AND a.attrelid = t.oid
          AND a.attnum = ANY(ix.indkey)
          AND t.relkind = 'r'
          AND t.relname = ?;
      `,
      [tableName]
    );

    const indexedFields = new Set(indexes.rows.map((row: any) => row.attname));

    // Return fields that are used but not indexed
    return usedFields.filter((field) => !indexedFields.has(field));
  }

  /**
   * Checks for inefficient sorting operations
   */
  async hasIneffientSorting(params: QueryParams): Promise<boolean> {
    if (!params.orderBy?.length) return false;

    const explain = await this.getExplainPlan(params);

    // Look for problematic sort patterns
    const inefficientPatterns = [
      this.hasMergeSortWithHighMemory(explain),
      this.hasFileSortOnUnindexedColumns(explain, params.orderBy),
    ];

    return inefficientPatterns.some((pattern) => pattern);
  }

  /**
   * Helper methods
   */
  private async getExplainPlan(params: QueryParams): Promise<any> {
    const query = this.buildQuery(params);
    const explain = await query.explain("json");
    return JSON.parse(explain);
  }

  private extractUsedFields(params: QueryParams): string[] {
    const fields = new Set<string>();

    // Extract fields from various clause types
    if (params.filter) {
      Object.keys(params.filter).forEach((field) => fields.add(field));
    }

    if (params.whereRaw) {
      params.whereRaw.forEach((clause) => fields.add(clause.field));
    }

    if (params.whereBetween) {
      params.whereBetween.forEach((clause) => fields.add(clause.field));
    }

    if (params.orderBy) {
      params.orderBy.forEach((clause) => fields.add(clause.field));
    }

    return Array.from(fields);
  }

  private hasNestedLoops(plan: any): boolean {
    const findNestedLoop = (node: any): boolean => {
      if (!node) return false;

      if (node["Node Type"]?.includes("Nested Loop")) {
        return true;
      }

      if (Array.isArray(node.Plans)) {
        return node.Plans.some((subPlan: any) => findNestedLoop(subPlan));
      }

      return false;
    };

    return findNestedLoop(plan);
  }

  private hasCartesianJoins(plan: any): boolean {
    const findCartesian = (node: any): boolean => {
      if (!node) return false;

      if (node["Node Type"]?.includes("Join") && !node["Join Type"]) {
        return true;
      }

      if (Array.isArray(node.Plans)) {
        return node.Plans.some((subPlan: any) => findCartesian(subPlan));
      }

      return false;
    };

    return findCartesian(plan);
  }

  private hasMultipleJoinsOnUnindexedColumns(plan: any): boolean {
    let joinCount = 0;

    const countJoinsOnUnindexedColumns = (node: any) => {
      if (!node) return;

      if (
        node["Node Type"]?.includes("Join") &&
        !node["Index Cond"] &&
        node["Join Type"] !== "Inner"
      ) {
        joinCount++;
      }

      if (Array.isArray(node.Plans)) {
        node.Plans.forEach((subPlan: any) =>
          countJoinsOnUnindexedColumns(subPlan)
        );
      }
    };

    countJoinsOnUnindexedColumns(plan);
    return joinCount > 1;
  }

  private hasMergeSortWithHighMemory(plan: any): boolean {
    const MEMORY_THRESHOLD = 1000000; // 1MB in bytes

    const findHighMemorySort = (node: any): boolean => {
      if (!node) return false;

      if (
        node["Node Type"]?.includes("Sort") &&
        node["Sort Method"]?.includes("external merge") &&
        node["Sort Space Used"] > MEMORY_THRESHOLD
      ) {
        return true;
      }

      if (Array.isArray(node.Plans)) {
        return node.Plans.some((subPlan: any) => findHighMemorySort(subPlan));
      }

      return false;
    };

    return findHighMemorySort(plan);
  }

  private hasFileSortOnUnindexedColumns(
    plan: any,
    orderByClauses: Array<{ field: string }>
  ): boolean {
    const findFileSortOnUnindexed = (node: any): boolean => {
      if (!node) return false;

      if (node["Node Type"]?.includes("Sort")) {
        const sortedFields = node["Sort Key"];
        return sortedFields.some((field: string) =>
          orderByClauses.some(
            (clause) => field.includes(clause.field) && !node["Index Name"]
          )
        );
      }

      if (Array.isArray(node.Plans)) {
        return node.Plans.some((subPlan: any) =>
          findFileSortOnUnindexed(subPlan)
        );
      }

      return false;
    };

    return findFileSortOnUnindexed(plan);
  }
}
