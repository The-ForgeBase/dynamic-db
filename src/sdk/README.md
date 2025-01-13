# Dynamic Database SDK

A powerful and flexible database query builder SDK that provides a fluent interface for building complex SQL queries with type safety.

## Features

- Fluent query building API
- Type-safe operations
- Advanced filtering and sorting
- Window functions support
- CTEs (Common Table Expressions) support
- Aggregate functions
- Transformations and pivoting
- Caching support
- Query validation and optimization

## Installation

```bash
npm install dynamic-db-sdk
```

## Basic Usage

```typescript
import { DatabaseSDK } from "dynamic-db-sdk";

const db = new DatabaseSDK("https://api.example.com");

// Simple query
const users = await db
  .table("users")
  .where("status", "active")
  .orderBy("created_at", "desc")
  .limit(10)
  .execute();
```

## Advanced Features

### Sorting with NULLS handling

```typescript
db.table("users")
  .orderBy("lastName", "asc", "nulls last")
  .orderBy({ field: "age", direction: "desc", nulls: "first" })
  .execute();
```

### Window Functions

```typescript
db.table("sales")
  .window("row_number", "row_num", {
    partitionBy: ["department"],
    orderBy: [{ field: "amount", direction: "desc" }],
  })
  .execute();
```

### Common Table Expressions (CTEs)

```typescript
const salesCTE = db
  .table("sales")
  .groupBy("department")
  .sum("amount", "total_sales");

db.table("departments").with("dept_sales", salesCTE).execute();
```

### Complex Filtering

```typescript
db.table("products")
  .where("category", "electronics")
  .andWhere((query) => {
    query.where("price", ">", 100).orWhere("rating", ">=", 4.5);
  })
  .execute();
```

### Generate the query parameters without executing

```typescript
db.table("products")
  .where("category", "electronics")
  .andWhere((query) => {
    query.where("price", ">", 100).orWhere("rating", ">=", 4.5);
  })
  .toParams();
```

## API Documentation

### Query Building Methods

- `where()`: Add WHERE clauses
- `orderBy()`: Add ORDER BY clauses
- `groupBy()`: Add GROUP BY clauses
- `having()`: Add HAVING clauses
- `limit()`: Set LIMIT
- `offset()`: Set OFFSET
- `window()`: Add window functions
- `with()`: Add CTEs
- `aggregate()`: Add aggregate functions
- `transform()`: Apply transformations to results

### Aggregate Functions

- `count()`
- `sum()`
- `avg()`
- `min()`
- `max()`

### Window Functions

- `rowNumber()`
- `rank()`
- `denseRank()`
- `lag()`
- `lead()`

## Best Practices

1. Always use parameterized queries for security
2. Implement proper error handling
3. Use type definitions for better type safety
4. Consider implementing caching for frequently used queries
5. Use query validation for complex queries

## Examples

See `examples.ts` for comprehensive examples of all features.

## License

MIT
