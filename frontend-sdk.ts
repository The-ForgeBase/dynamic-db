// types.ts
// ... (previous types remain the same) ...

export interface RecursiveCTE extends CTE {
  isRecursive: true;
  initialQuery: QueryBuilder<any>;
  recursiveQuery: QueryBuilder<any>;
  unionAll?: boolean;
}

export interface WindowFunctionAdvanced extends WindowFunction {
  over?: {
    partitionBy?: string[];
    orderBy?: OrderByClause[];
    frame?: {
      type: 'ROWS' | 'RANGE';
      start: 'UNBOUNDED PRECEDING' | 'CURRENT ROW' | number;
      end?: 'UNBOUNDED FOLLOWING' | 'CURRENT ROW' | number;
    };
  };
  filter?: WhereClause[];
}

export interface CacheConfig {
  ttl: number;
  key?: string;
  tags?: string[];
  condition?: (params: QueryParams) => boolean;
}

export interface QueryValidation {
  rules: {
    maxLimit?: number;
    requiredFields?: string[];
    disallowedFields?: string[];
    maxComplexity?: number;
  };
  suggestions?: boolean;
}

export interface QueryParams {
  // ... (previous query params remain the same) ...
  recursiveCtes?: RecursiveCTE[];
  advancedWindows?: WindowFunctionAdvanced[];
  cache?: CacheConfig;
  validation?: QueryValidation;
}

// Cache manager
class QueryCache {
  private cache: Map<string, { data: any; expires: number; tags: string[] }> = new Map();

  set(key: string, data: any, ttl: number, tags: string[] = []): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl * 1000,
      tags
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidateByTags(tags: string[]): void {
    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.cache.delete(key);
      }
    }
  }
}

// Query validator and optimizer
class QueryValidator {
  validateQuery(params: QueryParams, rules: QueryValidation['rules']): string[] {
    const violations: string[] = [];

    if (rules.maxLimit && params.limit && params.limit > rules.maxLimit) {
      violations.push(`Limit exceeds maximum allowed value of ${rules.maxLimit}`);
    }

    if (rules.requiredFields) {
      const missingFields = rules.requiredFields.filter(
        field => !this.hasField(params, field)
      );
      if (missingFields.length > 0) {
        violations.push(`Missing required fields: ${missingFields.join(', ')}`);
      }
    }

    return violations;
  }

  generateOptimizationSuggestions(params: QueryParams): string[] {
    const suggestions: string[] = [];

    // Check for missing indexes
    if (this.hasComplexWhere(params) && !params.orderBy) {
      suggestions.push('Consider adding indexes for frequently filtered fields');
    }

    // Check for expensive operations
    if (this.hasMultipleJoins(params)) {
      suggestions.push('Multiple joins detected. Consider denormalization or materialized views');
    }

    return suggestions;
  }

  private hasField(params: QueryParams, field: string): boolean {
    // Implementation to check if field is used in query
    return true;
  }

  private hasComplexWhere(params: QueryParams): boolean {
    return !!(params.whereRaw?.length || params.whereGroups?.length);
  }

  private hasMultipleJoins(params: QueryParams): boolean {
    // Implementation to check for multiple joins
    return false;
  }
}

// Enhanced QueryBuilder
class QueryBuilder<T> {
  private cache: QueryCache;
  private validator: QueryValidator;

  constructor(
    private sdk: DatabaseSDK,
    private tableName: string
  ) {
    this.cache = new QueryCache();
    this.validator = new QueryValidator();
  }

  /**
   * Add a recursive CTE
   */
  withRecursive(
    name: string,
    initialQuery: QueryBuilder<any>,
    recursiveQuery: QueryBuilder<any>,
    options: { unionAll?: boolean; columns?: string[] } = {}
  ): this {
    if (!this.params.recursiveCtes) {
      this.params.recursiveCtes = [];
    }

    this.params.recursiveCtes.push({
      name,
      isRecursive: true,
      initialQuery,
      recursiveQuery,
      unionAll: options.unionAll,
      columns: options.columns,
      query: initialQuery // for compatibility with non-recursive CTEs
    });

    return this;
  }

  /**
   * Advanced window function
   */
  windowAdvanced(
    type: WindowFunction['type'],
    alias: string,
    config: Partial<WindowFunctionAdvanced>
  ): this {
    if (!this.params.advancedWindows) {
      this.params.advancedWindows = [];
    }

    this.params.advancedWindows.push({
      type,
      alias,
      ...config
    });

    return this;
  }

  /**
   * Configure caching for the query
   */
  cache(config: CacheConfig): this {
    this.params.cache = config;
    return this;
  }

  /**
   * Set validation rules
   */
  validate(rules: QueryValidation['rules'], suggestions = true): this {
    this.params.validation = { rules, suggestions };
    return this;
  }

  /**
   * Execute with caching and validation
   */
  async execute(): Promise<ApiResponse<T>> {
    // Validate query
    if (this.params.validation) {
      const violations = this.validator.validateQuery(
        this.params,
        this.params.validation.rules
      );
      
      if (violations.length > 0) {
        throw new Error(`Query validation failed: ${violations.join(', ')}`);
      }

      if (this.params.validation.suggestions) {
        const suggestions = this.validator.generateOptimizationSuggestions(this.params);
        if (suggestions.length > 0) {
          console.warn('Query optimization suggestions:', suggestions);
        }
      }
    }

    // Check cache
    if (this.params.cache) {
      const cacheKey = this.params.cache.key || this.generateCacheKey();
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const result = await this.sdk.getRecords<T>(this.tableName, this.params);
      
      if (this.params.cache.condition?.(this.params) ?? true) {
        this.cache.set(
          cacheKey,
          result,
          this.params.cache.ttl,
          this.params.cache.tags
        );
      }

      return result;
    }

    return this.sdk.getRecords<T>(this.tableName, this.params);
  }

  private generateCacheKey(): string {
    return `${this.tableName}:${JSON.stringify(this.params)}`;
  }
}
