# Dynamic Database API (Experimental)

> ⚠️ **Note**: This is an experimental project for exploring dynamic database management concepts. Not recommended for production use.

## Features

- **Dynamic Schema Management**
  - Create and delete tables dynamically via API
  - Support for various column types (string, integer, boolean, decimal) - Automatic primary key handling - Unique constraints support
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

## Technology Stack

- Hono (Web Framework)
- Knex.js (Query Builder)
- SQLite (Database)
- TypeScript

## Limitations

- This is an experimental project
- Limited data type support
- Basic validation only
- No authentication/authorization
- No production-ready security features

## References

- [Knex.js Documentation](https://knexjs.org/)
- [knex schema inspector](https://github.com/knex/knex-schema-inspector)
- [Hono Documentation](https://hono.dev/)
<!-- - [https://github.com/arthurkushman/buildsqlx?utm_campaign=awesomego&utm_medium=referral&utm_source=awesomego](For Golang)
- [https://awesome-go.com/sql-query-builders/](For Golang) -->
