# Dynamic Database API (Experimental)

> ⚠️ **Note**: This is an experimental project for exploring dynamic database management concepts. Not recommended for production use.

## Features

- **Dynamic Schema Management**
  - Create and delete tables dynamically via API (Sqlite, Postgres, MySql, MSSql, and any knex compatible database)
  - Support for various column types (string, integer, boolean, decimal and more) - Automatic primary key handling - Unique constraints support
- **Data Operations**

  - CRUD operations for any table
  - Filtered queries with pagination
  - Safe parameter handling

- **Database Inspection**

  - Retrieve complete database schema
  - Table structure inspection
  - Foreign key relationship information

- **Event Hooks System**

  - Before/After query hooks
  - Before/After mutation hooks (create/update/delete)
  - Real-time operation logging
  - Extensible event system

- **Row-Level Security (RLS)**

  - Fine-grained access control at row level
  - Multiple permission rule types:
    - Public/Auth/Guest access
    - Label-based permissions
    - Team-based permissions
    - Field-value checks
    - Custom SQL conditions
  - Permission persistence in database
  - Real-time permission evaluation

- **Permission Management**
  - CRUD operations for table permissions
  - Operation-specific rules (SELECT/INSERT/UPDATE/DELETE)
  - Flexible permission rule configuration
  - Database-backed permission storage

- **Multiple SDK (Server and Client side)**
  - Check the example.ts file at the root of the folder
  - Also check `src/sdk` for full code implementation

- **Others**
  - ClI for type generate `src/cli` in zod and ts
  - Dashboard example `src/dashoard`
  - Can be use as a package `src/framework` and `src/dashboard/route.ts`

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Server will be running at:
# http://localhost:3000
```

## API Examples

### Create a Table

```http
POST /schema
{
  "action": "create",
  "tableName": "users",
  "columns": [
    { "name": "id", "type": "increments", "primary": true },
    { "name": "name", "type": "string" },
    { "name": "email", "type": "string", "unique": true }
  ]
}
```

### Query Records

```http
GET /records/users?filter={"name":"John"}&limit=10&offset=0
```

### Insert Record

```http
POST /data/users
{
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Permission Management

#### Get Table Permissions

```http
GET /permissions/users
```

#### Set Table Permissions

```http
POST /permissions/users
{
  "operations": {
    "SELECT": [
      { "allow": "public" }
    ],
    "INSERT": [
      { "allow": "auth" }
    ],
    "UPDATE": [
      { "allow": "labels", "labels": ["admin"] }
    ],
    "DELETE": [
      { "allow": "teams", "teams": ["moderators"] }
    ]
  }
}
```

#### Field-Based Permission Example

```http
POST /permissions/posts
{
  "operations": {
    "SELECT": [
      {
        "allow": "fieldCheck",
        "fieldCheck": {
          "field": "authorId",
          "operator": "===",
          "valueType": "userContext",
          "value": "userId"
        }
      }
    ]
  }
}
```

#### Delete Table Permissions

```http
DELETE /permissions/users
```

## Technology Stack

- Hono (Web Framework)
- Knex.js (Query Builder)
- SQLite (Database)
- TypeScript


## References

- [Knex.js Documentation](https://knexjs.org/)
- [knex schema inspector](https://github.com/knex/knex-schema-inspector)
- [Hono Documentation](https://hono.dev/)
<!-- - [https://github.com/arthurkushman/buildsqlx?utm_campaign=awesomego&utm_medium=referral&utm_source=awesomego](For Golang)
- [https://awesome-go.com/sql-query-builders/](For Golang) -->
<!-- explore save-eval for more complex case -->
