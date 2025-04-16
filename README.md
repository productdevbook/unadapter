<div align="center">

# unadapter

<img src="https://img.shields.io/badge/Status-Work%20In%20Progress-orange" alt="Work In Progress"/>

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![CI Status](https://github.com/productdevbook/unadapter/actions/workflows/ci.yml/badge.svg)](https://github.com/productdevbook/unadapter/actions/workflows/ci.yml)
[![License][license-src]][license-href]
[![JSDocs][jsdocs-src]][jsdocs-href]

### Test Coverage
![Lines](https://img.shields.io/badge/Lines-80.65%25-green)
![Statements](https://img.shields.io/badge/Statements-80.65%25-green)
![Functions](https://img.shields.io/badge/Functions-79.62%25-yellowgreen)
![Branches](https://img.shields.io/badge/Branches-78.52%25-yellowgreen)

**A universal adapter interface for connecting various databases and ORMs with a standardized API.**

<hr />

</div>

## 🚧 Ongoing Development
> **Note:** This project is currently under active development. Features and APIs may change.

This project is based on the adapter architecture from [better-auth](https://github.com/better-auth) and is being developed to provide a standalone, ESM-compatible adapter solution that can be used across various open-source projects.

<details>
<summary><b>📋 Development Roadmap</b></summary>

- [x] Initial adapter architecture
- [x] Basic adapters implementation
- [ ] Comprehensive documentation
- [ ] Performance optimizations
- [ ] Additional adapter types
- [ ] Integration examples
- [ ] Complete abstraction from better-auth and compatibility with all software systems

</details>

## 🌟 Overview

unadapter provides a consistent interface for database operations, allowing you to switch between different database solutions without changing your application code. This is particularly useful for applications that need database-agnostic operations or might need to switch database providers in the future.

I've seen the need for this kind of adapter system in several of my own projects and across the open-source ecosystem. In the future, better-auth might utilize unadapter, bringing this unified adapter structure to a wider range of open-source projects with full ESM support.

## 📦 Installation

```bash
# Using pnpm
pnpm add unadapter

# Using npm
npm install unadapter

# Using yarn
yarn add unadapter
```

You'll also need to install the specific database driver or ORM you plan to use.

## 🧩 Available Adapters

<table>
  <tr>
    <th>Adapter</th>
    <th>Description</th>
    <th>Status</th>
  </tr>
  <tr>
    <td><b>Memory Adapter</b></td>
    <td>In-memory adapter ideal for development and testing</td>
    <td>✅ Ready</td>
  </tr>
  <tr>
    <td><b><a href="https://www.prisma.io/">Prisma Adapter</a></b></td>
    <td>For Prisma ORM</td>
    <td>✅ Ready</td>
  </tr>
  <tr>
    <td><b><a href="https://www.mongodb.com/">MongoDB Adapter</a></b></td>
    <td>For MongoDB</td>
    <td>✅ Ready</td>
  </tr>
  <tr>
    <td><b><a href="https://orm.drizzle.team/">Drizzle Adapter</a></b></td>
    <td>For Drizzle ORM</td>
    <td>✅ Ready</td>
  </tr>
  <tr>
    <td><b><a href="https://kysely.dev/">Kysely Adapter</a></b></td>
    <td>For Kysely SQL query builder</td>
    <td>✅ Ready</td>
  </tr>
</table>

## ✨ Features

- 🔄 Standardized interface for common database operations (create, read, update, delete)
- 🛡️ Type-safe operations
- 🔍 Support for complex queries and transformations
- 🌐 Database-agnostic application code
- 🔄 Easy switching between different database providers
- 🗺️ Custom field mapping
- 📊 Support for various data types across different database systems


## 🚀 Getting Started

### Basic Usage

```typescript
import { memoryAdapter } from 'unadapter/adapters/memory'

// Create an in-memory database for testing
const db = {
  user: [],
  session: []
}

// Initialize the adapter
const adapter = memoryAdapter(db)

// Now you can use the adapter to perform database operations
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
})

// Find the user
const foundUser = await adapter.findOne({
  model: 'user',
  where: [
    {
      field: 'email',
      value: 'john@example.com'
    }
  ]
})

// Update the user
const updatedUser = await adapter.update({
  model: 'user',
  where: [
    {
      field: 'id',
      value: user.id
    }
  ],
  update: {
    name: 'John Smith'
  }
})

// Delete the user
await adapter.delete({
  model: 'user',
  where: [
    {
      field: 'id',
      value: user.id
    }
  ]
})
```

### Using Prisma Adapter

```typescript
import { PrismaClient } from '@prisma/client'
import { prismaAdapter } from 'unadapter/adapters/prisma'

const prisma = new PrismaClient()
const adapter = prismaAdapter(prisma)

// Now you can use the same adapter interface with Prisma
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
})
```

### Using MongoDB Adapter

```typescript
import { MongoClient } from 'mongodb'
import { mongodbAdapter } from 'unadapter/adapters/mongodb'

const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
const db = client.db('myDatabase')

const adapter = mongodbAdapter(db)

// Now you can use the same adapter interface with MongoDB
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Alex Smith',
    email: 'alex@example.com',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
})
```

### Using Drizzle Adapter

```typescript
import { drizzle } from 'drizzle-orm/...' // Import appropriate driver
import { drizzleAdapter } from 'unadapter/adapters/drizzle'

const db = drizzle(/* your DB connection */)
const adapter = drizzleAdapter(db, {
  provider: 'postgresql', // or 'mysql', 'sqlite'
  usePlural: false
})

// Now you can use the same adapter interface with Drizzle
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Taylor Swift',
    email: 'taylor@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
})
```

### Using Kysely Adapter

```typescript
import { Kysely } from 'kysely'
import { kyselyAdapter } from 'unadapter/adapters/kysely'

const db = new Kysely(/* your DB connection */)
const adapter = kyselyAdapter(db, {
  type: 'postgresql', // or 'mysql', 'sqlite', 'mssql'
  usePlural: false
})

// Now you can use the same adapter interface with Kysely
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Chris Evans',
    email: 'chris@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
})
```

## 🔍 API Reference

### Adapter Interface

All adapters implement the following interface:

```typescript
interface Adapter {
  id: string;
  
  // Create a new record
  create<T>({
    model: string,
    data: Omit<T, 'id'>,
    select?: string[]
  }): Promise<T>;
  
  // Find a single record
  findOne<T>({
    model: string,
    where: Where[],
    select?: string[]
  }): Promise<T | null>;
  
  // Find multiple records
  findMany<T>({
    model: string,
    where?: Where[],
    limit?: number,
    sortBy?: {
      field: string,
      direction: 'asc' | 'desc'
    },
    offset?: number
  }): Promise<T[]>;
  
  // Update a record
  update<T>({
    model: string,
    where: Where[],
    update: Record<string, any>
  }): Promise<T | null>;
  
  // Update multiple records
  updateMany({
    model: string,
    where: Where[],
    update: Record<string, any>
  }): Promise<number>;
  
  // Delete a record
  delete({
    model: string,
    where: Where[]
  }): Promise<void>;
  
  // Delete multiple records
  deleteMany({
    model: string,
    where: Where[]
  }): Promise<number>;
  
  // Count records
  count({
    model: string,
    where?: Where[]
  }): Promise<number>;
  
  // Additional options
  options?: Record<string, any>;
}
```

### Where Clause Interface

The `Where` interface is used for filtering records:

```typescript
interface Where {
  field: string;
  value?: any;
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'starts_with' | 'ends_with';
  connector?: 'AND' | 'OR';
}
```

### Creating Custom Adapters

You can create your own adapters using the `createAdapter` function:

```typescript
import { createAdapter } from 'unadapter/adapters/create'

const myCustomAdapter = createAdapter({
  config: {
    adapterId: 'my-custom',
    adapterName: 'My Custom Adapter',
    usePlural: false,
    supportsJSON: true,
    supportsDates: true,
    supportsBooleans: true
  },
  adapter: ({ options, schema }) => {
    // Implement adapter methods
    return {
      async create({ model, data }) {
        // Your implementation here
      },
      async findOne({ model, where, select }) {
        // Your implementation here
      },
      async findMany({ model, where, limit, sortBy, offset }) {
        // Your implementation here
      },
      async update({ model, where, update }) {
        // Your implementation here
      },
      async updateMany({ model, where, update }) {
        // Your implementation here
      },
      async delete({ model, where }) {
        // Your implementation here
      },
      async deleteMany({ model, where }) {
        // Your implementation here
      },
      async count({ model, where }) {
        // Your implementation here
      }
    }
  }
})
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to help improve unadapter.

## 🙏 Credits

This project draws inspiration and core concepts from:

- [better-auth](https://github.com/better-auth) - The original adapter architecture that inspired this project

## 📝 License

See the [LICENSE](LICENSE) file for details.


<hr />

<div align="center">
  <p><i>unadapter is a work in progress. Stay tuned for updates!</i></p>
</div>

[npm-version-src]: https://img.shields.io/npm/v/unadapter?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/unadapter
[npm-downloads-src]: https://img.shields.io/npm/dm/unadapter?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/unadapter
[bundle-src]: https://img.shields.io/bundlephobia/minzip/unadapter?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=unadapter
[license-src]: https://img.shields.io/github/license/productdevbook/unadapter.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/productdevbook/unadapter/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/unadapter
