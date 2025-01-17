# Framework Core

This directory houses the core components of the application framework. It is designed to simplify the process of building applications that rely on a database for data persistence and management.

## Overview

This framework offers a streamlined approach to developing applications with database backends. It leverages Knex.js for database interactions, providing a robust and flexible query builder. The framework also integrates features for permission management and real-time updates, making it suitable for a wide range of application types.

## Key Features

- **Database Management**: Uses Knex.js to interact with databases, offering an intuitive API for querying, creating, updating, and deleting data.
- **Permission Management**: Includes a sophisticated system for managing permissions, allowing you to control data access at a granular level.
- **Real-Time Support**: Capable of handling real-time updates, enabling applications to respond dynamically to data changes.
- **Hooks**: Provides a mechanism for implementing hooks, allowing you to intercept and modify database operations.

## Core Components

This directory contains the following essential parts of the framework:

- **Database**: The core database integration logic, including schema management and data manipulation.
- **Permission Management**: The system responsible for handling permissions and access control.
- **Hooks**: The mechanism for intercepting and modifying database operations.
- **Types**: All type definitions used within the framework.
- **Adapters**: logic for different adapter implementations, like express, or other type of servers.
- **Schema**: the files needed for modify the schema.
- **index**: the main file, that exports and expose all the framework capabilities

## Usage

This framework is designed to be integrated into a larger application. The components within this directory are the building blocks for creating database-backed applications with advanced features.

## Contributing

Contributions to the framework are welcome. Please refer to the main project's contributing guidelines for more information.
