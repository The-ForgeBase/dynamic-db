// types.ts
// ... (previous types remain the same) ...

export interface WindowFunction {
  type: 'row_number' | 'rank' | 'dense_rank' | 'lag' | 'lead' | 'first_value' | 'last_value';
  field?: string;
  alias: string;
  partitionBy?: string[];
  orderBy?: OrderByClause[];
  frameClause?: string;
}

export interface CTE {
  name: string;
  query: QueryBuilder<any>;
  columns?: string[];
}

export interface TransformConfig {
  groupBy?: string[];
  pivot?: {
    column: string;
    values: string[];
    aggregate: AggregateOptions;
  };
  flatten?: boolean;
  select?: string[];
  compute?: Record<string, (row: any) => any>;
}

export interface ExplainOptions {
  analyze?: boolean;
  verbose?: boolean;
  format?: 'text' | 'json';
}

export interface QueryParams {
  // ... (previous query params remain the same) ...
  windowFunctions?: WindowFunction[];
  ctes?: CTE[];
  transforms?: TransformConfig;
  explain?: ExplainOptions;
}

// Enhanced QueryBuilder with advanced features
class QueryBuilder<T> {
  private params: QueryParams = {};
  private ctes: Map<string, CTE> = new Map();
  
  constructor(
    private sdk: DatabaseSDK,
    private tableName: string
  ) {}

  /**
   * Add a window function
   */
  window(
    type: WindowFunction['type'],
    alias: string,
    config: Partial<Omit<WindowFunction, 'type' | 'alias'>> = {}
  ): this {
    if (!this.params.windowFunctions) {
      this.params.windowFunctions = [];
    }
    
    this.params.windowFunctions.push({
      type,
      alias,
      field: config.field,
      partitionBy: config.partitionBy,
      orderBy: config.orderBy,
      frameClause: config.frameClause
    });
    
    return this;
  }

  /**
   * Add common window functions
   */
  rowNumber(alias: string, partitionBy?: string[], orderBy?: OrderByClause[]): this {
    return this.window('row_number', alias, { partitionBy, orderBy });
  }

  rank(alias: string, partitionBy?: string[], orderBy?: OrderByClause[]): this {
    return this.window('rank', alias, { partitionBy, orderBy });
  }

  lag(field: string, alias: string, partitionBy?: string[], orderBy?: OrderByClause[]): this {
    return this.window('lag', alias, { field, partitionBy, orderBy });
  }

  lead(field: string, alias: string, partitionBy?: string[], orderBy?: OrderByClause[]): this {
    return this.window('lead', alias, { field, partitionBy, orderBy });
  }

  /**
   * Add a CTE (WITH clause)
   */
  with(name: string, queryOrCallback: QueryBuilder<any> | ((query: QueryBuilder<any>) => void), columns?: string[]): this {
    let query: QueryBuilder<any>;
    
    if (typeof queryOrCallback === 'function') {
      query = new QueryBuilder(this.sdk, this.tableName);
      queryOrCallback(query);
    } else {
      query = queryOrCallback;
    }

    this.ctes.set(name, {
      name,
      query,
      columns
    });

    if (!this.params.ctes) {
      this.params.ctes = [];
    }
    this.params.ctes.push({ name, query, columns });
    
    return this;
  }

  /**
   * Transform the result set
   */
  transform(config: TransformConfig): this {
    this.params.transforms = {
      ...this.params.transforms,
      ...config
    };
    return this;
  }

  /**
   * Pivot the result set
   */
  pivot(column: string, values: string[], aggregate: AggregateOptions): this {
    return this.transform({
      pivot: {
        column,
        values,
        aggregate
      }
    });
  }

  /**
   * Compute new fields from existing ones
   */
  compute(computations: Record<string, (row: any) => any>): this {
    return this.transform({
      compute: computations
    });
  }

  /**
   * Explain the query plan
   */
  explain(options: ExplainOptions = {}): this {
    this.params.explain = options;
    return this;
  }

  /**
   * Execute with transformations
   */
  async execute(): Promise<ApiResponse<T>> {
    const response = await this.sdk.getRecords<T>(this.tableName, this.params);
    
    if (this.params.transforms && response.records) {
      return this.applyTransformations(response);
    }
    
    return response;
  }

  private applyTransformations(response: ApiResponse<T>): ApiResponse<T> {
    let transformed = [...(response.records || [])];
    const transforms = this.params.transforms!;

    // Apply computations
    if (transforms.compute) {
      transformed = transformed.map(row => ({
        ...row,
        ...Object.entries(transforms.compute!).reduce((acc, [key, fn]) => ({
          ...acc,
          [key]: fn(row)
        }), {})
      }));
    }

    // Apply grouping
    if (transforms.groupBy) {
      transformed = this.groupResults(transformed, transforms.groupBy);
    }

    // Apply pivoting
    if (transforms.pivot) {
      transformed = this.pivotResults(transformed, transforms.pivot);
    }

    return {
      ...response,
      records: transformed
    };
  }

  private groupResults(records: T[], groupBy: string[]): any[] {
    // Implementation of grouping logic
    return records;
  }

  private pivotResults(records: T[], pivot: TransformConfig['pivot']): any[] {
    // Implementation of pivot logic
    return records;
  }
}

// Example usage
async function demonstrateAdvancedFeatures() {
  const db = new DatabaseSDK('https://api.example.com');

  // Window functions
  const salesRank = await db.table<Order>('orders')
    .select('customer_id', 'amount')
    .rowNumber('sales_rank', ['customer_id'], [{ field: 'amount', direction: 'desc' }])
    .window('lag', 'prev_amount', {
      field: 'amount',
      partitionBy: ['customer_id'],
      orderBy: [{ field: 'created_at' }]
    })
    .execute();

  // CTEs and transformations
  const customerAnalysis = await db.table<Customer>('customers')
    .with('high_value_orders', qb => 
      qb.table<Order>('orders')
        .where('amount', '>', 1000)
        .groupBy('customer_id')
        .sum('amount', 'total_spent')
    )
    .join('high_value_orders', 'customers.id', 'high_value_orders.customer_id')
    .transform({
      compute: {
        customer_tier: row => row.total_spent > 10000 ? 'VIP' : 'Regular',
        full_name: row => `${row.first_name} ${row.last_name}`
      }
    })
    .execute();

  // Pivoting
  const monthlyStats = await db.table<Order>('orders')
    .select('product_id', 'month', 'revenue')
    .pivot('month', ['Jan', 'Feb', 'Mar'], {
      type: 'sum',
      field: 'revenue',
      alias: 'monthly_revenue'
    })
    .execute();

  // Query explanation
  const queryPlan = await db.table<Order>('orders')
    .where('amount', '>', 1000)
    .explain({
      analyze: true,
      verbose: true,
      format: 'json'
    })
    .execute();
}
