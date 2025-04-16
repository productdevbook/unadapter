# unadapter

A universal adapter interface for connecting various databases and ORMs with a standardized API.

## Overview

This project is based on the adapter architecture from [better-auth](https://github.com/better-auth) and is being developed to provide a standalone, ESM-compatible adapter solution that can be used across various open-source projects.

unadapter provides a consistent interface for database operations, allowing you to switch between different database solutions without changing your application code. This is particularly useful for applications that need database-agnostic operations or might need to switch database providers in the future.

I've seen the need for this kind of adapter system in several of my own projects and across the open-source ecosystem. In the future, better-auth might utilize unadapter, bringing this unified adapter structure to a wider range of open-source projects with full ESM support.

## Available Adapters

This package includes the following adapters:

- **Memory Adapter**: In-memory adapter ideal for development and testing
- **Prisma Adapter**: For [Prisma ORM](https://www.prisma.io/)
- **MongoDB Adapter**: For [MongoDB](https://www.mongodb.com/)
- **Drizzle Adapter**: For [Drizzle ORM](https://orm.drizzle.team/)
- **Kysely Adapter**: For [Kysely](https://kysely.dev/) SQL query builder

## Features

- Standardized interface for common database operations (create, read, update, delete)
- Type-safe operations
- Support for complex queries and transformations
- Database-agnostic application code
- Easy switching between different database providers
- Custom field mapping
- Support for various data types across different database systems

## License

See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to help improve unadapter.