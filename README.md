# unadapter 

**A universal adapter interface for connecting various databases and ORMs with a standardized API.**


<img src="https://img.shields.io/badge/Status-Work%20In%20Progress-orange" alt="Work In Progress"/>

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]
[![CI Status](https://github.com/productdevbook/unadapter/actions/workflows/ci.yml/badge.svg)](https://github.com/productdevbook/unadapter/actions/workflows/ci.yml)
![Lines](https://img.shields.io/badge/Lines-73.19%25-yellowgreen)
![Statements](https://img.shields.io/badge/Statements-73.19%25-yellowgreen)
![Functions](https://img.shields.io/badge/Functions-83.87%25-green)
![Branches](https://img.shields.io/badge/Branches-76.47%25-yellowgreen)


## 🚀 Features

- 🔄 Standardized interface for common database operations (create, read, update, delete)
- 🛡️ Type-safe operations
- 🔍 Support for complex queries and transformations
- 🌐 Database-agnostic application code
- 🔄 Easy switching between different database providers
- 🗺️ Custom field mapping
- 📊 Support for various data types across different database systems
- 🏗️ Fully customizable schema definition

## 📚 Table of Contents

- [Overview](#-overview)
- [Installation](#-installation)
- [Available Adapters](#-available-adapters)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)
- [License](#-license)

## 🌟 Overview

unadapter provides a consistent interface for database operations, allowing you to switch between different database solutions without changing your application code. This is particularly useful for applications that need database-agnostic operations or might need to switch database providers in the future.

<details>
<summary><b>🚧 Development Status</b></summary>

This project is based on the adapter architecture from [better-auth](https://github.com/better-auth) and is being developed to provide a standalone, ESM-compatible adapter solution that can be used across various open-source projects.

#### Development Roadmap

- [x] Initial adapter architecture
- [x] Basic adapters implementation
- [ ] Comprehensive documentation
- [ ] Performance optimizations
- [ ] Additional adapter types
- [ ] Integration examples
- [ ] Complete abstraction from better-auth and compatibility with all software systems

#### Test Coverage
![Lines](https://img.shields.io/badge/Lines-73.19%25-yellowgreen)
![Statements](https://img.shields.io/badge/Statements-73.19%25-yellowgreen)
![Functions](https://img.shields.io/badge/Functions-83.87%25-green)
![Branches](https://img.shields.io/badge/Branches-76.47%25-yellowgreen)

[![CI Status](https://github.com/productdevbook/unadapter/actions/workflows/ci.yml/badge.svg)](https://github.com/productdevbook/unadapter/actions/workflows/ci.yml)
[![JSDocs][jsdocs-src]][jsdocs-href]

</details>

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

## 🚀 Getting Started

<details open>
<summary><b>Basic Usage</b></summary>

```typescript
import type { PluginSchema } from 'unadapter/types'
import { createAdapter, createTable, mergePluginSchemas } from 'unadapter'
import { memoryAdapter } from 'unadapter/memory'

// Create an in-memory database for testing
const db = {
  user: [],
  session: []
}

interface CustomOptions {
  appName?: string
  plugins?: {
    schema?: PluginSchema
  }[]
  user?: {
    fields?: {
      name?: string
      email?: string
      emailVerified?: string
      image?: string
      createdAt?: string
    }
  }
}

const tables = createTable<CustomOptions>((options) => {
  const { user, ...pluginTables } = mergePluginSchemas<CustomOptions>(options) || {}

  return {
    user: {
      modelName: 'user',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options?.user?.fields?.name || 'name',
          sortable: true,
        },
        email: {
          type: 'string',
          unique: true,
          required: true,
          fieldName: options?.user?.fields?.email || 'email',
          sortable: true,
        },
        emailVerified: {
          type: 'boolean',
          defaultValue: () => false,
          required: true,
          fieldName: options?.user?.fields?.emailVerified || 'emailVerified',
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          required: true,
          fieldName: options?.user?.fields?.createdAt || 'createdAt',
        },
        updatedAt: {
          type: 'date',
          defaultValue: () => new Date(),
          required: true,
          fieldName: options?.user?.fields?.updatedAt || 'updatedAt',
        },
        ...user?.fields,
        ...options?.user?.fields,
      }
    }
  }
})

const adapter = createAdapter(tables, {
  database: memoryAdapter(
    db,
    {}
  ),
  plugins: [] // Optional plugins
})

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
const foundUsers = await adapter.findMany({
  model: 'user',
  where: [
    {
      field: 'email',
      value: 'john@example.com',
      operator: 'eq',
    }
  ]
})
```
</details>

<details>
<summary><b>Using Custom Schema and Plugins</b></summary>

```typescript
import type { PluginSchema } from 'unadapter/types'
import { createAdapter, createTable, mergePluginSchemas } from 'unadapter'
import { memoryAdapter } from 'unadapter/memory'

// Create an in-memory database for testing
const db = {
  users: [],
  products: []
}

interface CustomOptions {
  appName?: string
  plugins?: {
    schema?: PluginSchema
  }[]
  user?: {
    fields?: {
      fullName?: string
      email?: string
      isActive?: string
    }
  }
  product?: {
    fields?: {
      title?: string
      price?: string
      ownerId?: string
    }
  }
}

const tables = createTable<CustomOptions>((options) => {
  const { user, product, ...pluginTables } = mergePluginSchemas<CustomOptions>(options) || {}

  return {
    user: {
      modelName: 'users', // The actual table/collection name in your database
      fields: {
        fullName: {
          type: 'string',
          required: true,
          fieldName: options?.user?.fields?.fullName || 'full_name',
          sortable: true,
        },
        email: {
          type: 'string',
          unique: true,
          required: true,
          fieldName: options?.user?.fields?.email || 'email_address',
        },
        isActive: {
          type: 'boolean',
          fieldName: options?.user?.fields?.isActive || 'is_active',
          defaultValue: () => true,
        },
        createdAt: {
          type: 'date',
          fieldName: 'created_at',
          defaultValue: () => new Date(),
        },
        ...user?.fields,
        ...options?.user?.fields,
      }
    },
    product: {
      modelName: 'products',
      fields: {
        title: {
          type: 'string',
          required: true,
          fieldName: options?.product?.fields?.title || 'title',
        },
        price: {
          type: 'number',
          required: true,
          fieldName: options?.product?.fields?.price || 'price',
        },
        ownerId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id',
            onDelete: 'cascade',
          },
          required: true,
          fieldName: options?.product?.fields?.ownerId || 'owner_id',
        },
        ...product?.fields,
        ...options?.product?.fields,
      }
    }
  }
})

// User profile plugin schema
const userProfilePlugin = {
  schema: {
    user: {
      modelName: 'user',
      fields: {
        bio: {
          type: 'string',
          required: false,
          fieldName: 'bio',
        },
        location: {
          type: 'string',
          required: false,
          fieldName: 'location',
        }
      }
    }
  }
}

const adapter = createAdapter(tables, {
  database: memoryAdapter(
    db,
    {}
  ),
  plugins: [userProfilePlugin],
})

// Now you can use the adapter with your custom schema
const user = await adapter.create({
  model: 'user',
  data: {
    fullName: 'John Doe',
    email: 'john@example.com',
    bio: 'Software developer',
    location: 'New York'
  }
})

// Create a product linked to the user
const product = await adapter.create({
  model: 'product',
  data: {
    title: 'Awesome Product',
    price: 99.99,
    ownerId: user.id
  }
})
```
</details>

### Database-Specific Adapters

<details>
<summary><b>MongoDB Adapter Example</b></summary>

```typescript
import type { PluginSchema } from 'unadapter/types'
import { createAdapter, createTable, mergePluginSchemas } from 'unadapter'
import { MongoClient } from 'mongodb'
import { mongodbAdapter } from 'unadapter/mongodb'

// Create a database client
const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
const db = client.db('myDatabase')

interface CustomOptions {
  user?: {
    fields?: {
      name?: string
      email?: string
      settings?: string
    }
  }
}

const tables = createTable<CustomOptions>((options) => {
  const { user, ...pluginTables } = mergePluginSchemas<CustomOptions>(options) || {}

  return {
    user: {
      modelName: 'users',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options?.user?.fields?.name || 'name',
        },
        email: {
          type: 'string',
          required: true,
          unique: true,
          fieldName: options?.user?.fields?.email || 'email',
        },
        settings: {
          type: 'json',
          required: false,
          fieldName: options?.user?.fields?.settings || 'settings',
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: 'createdAt',
        },
        ...user?.fields,
        ...options?.user?.fields,
      }
    }
  }
})

// Initialize the adapter
const adapter = createAdapter(tables, {
  database: mongodbAdapter(
    db,
    {
      useNumberId: false
    }
  ),
  plugins: []
})

// Use the adapter
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    settings: { theme: 'dark', notifications: true }
  }
})
```
</details>

<details>
<summary><b>Prisma Adapter Example</b></summary>

```typescript
import type { PluginSchema } from 'unadapter/types'
import { createAdapter, createTable, mergePluginSchemas } from 'unadapter'
import { PrismaClient } from '@prisma/client'
import { prismaAdapter } from 'unadapter/prisma'

// Initialize Prisma client
const prisma = new PrismaClient()

interface CustomOptions {
  user?: {
    fields?: {
      name?: string
      email?: string
      profile?: string
    }
  }
  post?: {
    fields?: {
      title?: string
      content?: string
      authorId?: string
    }
  }
}

const tables = createTable<CustomOptions>((options) => {
  const { user, post, ...pluginTables } = mergePluginSchemas<CustomOptions>(options) || {}

  return {
    user: {
      modelName: 'User', // Match your Prisma model name (case-sensitive)
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options?.user?.fields?.name || 'name',
        },
        email: {
          type: 'string',
          required: true,
          unique: true,
          fieldName: options?.user?.fields?.email || 'email',
        },
        profile: {
          type: 'json',
          required: false,
          fieldName: options?.user?.fields?.profile || 'profile',
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: 'createdAt',
        },
        ...user?.fields,
        ...options?.user?.fields,
      }
    },
    post: {
      modelName: 'Post',
      fields: {
        title: {
          type: 'string',
          required: true,
          fieldName: options?.post?.fields?.title || 'title',
        },
        content: {
          type: 'string',
          required: false,
          fieldName: options?.post?.fields?.content || 'content',
        },
        published: {
          type: 'boolean',
          defaultValue: () => false,
          fieldName: 'published',
        },
        authorId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id',
            onDelete: 'cascade',
          },
          required: true,
          fieldName: options?.post?.fields?.authorId || 'authorId',
        },
        ...post?.fields,
        ...options?.post?.fields,
      }
    }
  }
})

// Initialize the adapter
const adapter = createAdapter(tables, {
  database: prismaAdapter(
    prisma,
    {
      provider: 'postgresql',
      debugLogs: true,
      usePlural: false
    }
  ),
  plugins: []
})

// Use the adapter
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'John Smith',
    email: 'john.smith@example.com',
    profile: { bio: 'Software developer', location: 'New York' }
  }
})
```
</details>

<details>
<summary><b>Drizzle Adapter Example</b></summary>

```typescript
import type { PluginSchema } from 'unadapter/types'
import { createAdapter, createTable, mergePluginSchemas } from 'unadapter'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { drizzleAdapter } from 'unadapter/drizzle'

// Create a database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'myapp'
})

// Initialize Drizzle
const db = drizzle(pool)

interface CustomOptions {
  user?: {
    fields?: {
      name?: string
      email?: string
      role?: string
    }
  }
  task?: {
    fields?: {
      title?: string
      completed?: string
      userId?: string
    }
  }
}

const tables = createTable<CustomOptions>((options) => {
  const { user, task, ...pluginTables } = mergePluginSchemas<CustomOptions>(options) || {}

  return {
    user: {
      modelName: 'users',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options?.user?.fields?.name || 'name',
        },
        email: {
          type: 'string',
          unique: true,
          required: true,
          fieldName: options?.user?.fields?.email || 'email',
        },
        role: {
          type: 'string',
          defaultValue: () => 'user',
          fieldName: options?.user?.fields?.role || 'role',
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: 'created_at',
        },
        ...user?.fields,
        ...options?.user?.fields,
      }
    },
    task: {
      modelName: 'tasks',
      fields: {
        title: {
          type: 'string',
          required: true,
          fieldName: options?.task?.fields?.title || 'title',
        },
        completed: {
          type: 'boolean',
          defaultValue: () => false,
          fieldName: options?.task?.fields?.completed || 'completed',
        },
        userId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id',
          },
          required: true,
          fieldName: options?.task?.fields?.userId || 'user_id',
        },
        ...task?.fields,
        ...options?.task?.fields,
      }
    }
  }
})

// Initialize the adapter
const adapter = createAdapter(tables, {
  database: drizzleAdapter(
    db,
    {
      provider: 'mysql',
      defaultSchema: 'myapp'
    }
  ),
  plugins: []
})

// Use the adapter
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'admin'
  }
})
```
</details>

<details>
<summary><b>Kysely Adapter Example</b></summary>

```typescript
import type { PluginSchema } from 'unadapter/types'
import { createAdapter, createTable, mergePluginSchemas } from 'unadapter'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { kyselyAdapter } from 'unadapter/kysely'

// Create PostgreSQL connection pool
const pool = new pg.Pool({
  host: 'localhost',
  database: 'mydatabase',
  user: 'myuser',
  password: 'mypassword'
})

// Initialize Kysely with PostgreSQL dialect
const db = new Kysely({
  dialect: new PostgresDialect({ pool })
})

interface CustomOptions {
  user?: {
    fields?: {
      name?: string
      email?: string
      active?: string
      meta?: string
    }
  }
  article?: {
    fields?: {
      title?: string
      content?: string
      authorId?: string
    }
  }
}

const tables = createTable<CustomOptions>((options) => {
  const { user, article, ...pluginTables } = mergePluginSchemas<CustomOptions>(options) || {}

  return {
    user: {
      modelName: 'users',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options?.user?.fields?.name || 'name',
        },
        email: {
          type: 'string',
          required: true,
          unique: true,
          fieldName: options?.user?.fields?.email || 'email',
        },
        active: {
          type: 'boolean',
          defaultValue: () => true,
          fieldName: options?.user?.fields?.active || 'is_active',
        },
        meta: {
          type: 'json',
          required: false,
          fieldName: options?.user?.fields?.meta || 'meta_data',
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: 'created_at',
        },
        ...user?.fields,
        ...options?.user?.fields,
      }
    },
    article: {
      modelName: 'articles',
      fields: {
        title: {
          type: 'string',
          required: true,
          fieldName: options?.article?.fields?.title || 'title',
        },
        content: {
          type: 'string',
          required: true,
          fieldName: options?.article?.fields?.content || 'content',
        },
        authorId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id',
            onDelete: 'cascade',
          },
          required: true,
          fieldName: options?.article?.fields?.authorId || 'author_id',
        },
        tags: {
          type: 'array',
          required: false,
          fieldName: 'tags',
        },
        publishedAt: {
          type: 'date',
          required: false,
          fieldName: 'published_at',
        },
        ...article?.fields,
        ...options?.article?.fields,
      }
    }
  }
})

// Initialize the adapter
const adapter = createAdapter(tables, {
  database: kyselyAdapter(
    db,
    {
      defaultSchema: 'public'
    }
  ),
  plugins: []
})

// Use the adapter
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Robert Chen',
    email: 'robert@example.com',
    meta: { interests: ['programming', 'reading'], location: 'San Francisco' }
  }
})
```
</details>

## 🔍 API Reference

<details>
<summary><b>Adapter Interface</b></summary>

All adapters implement the following interface:

```typescript
interface Adapter {
  // Create a new record
  create<T>({
    model: string,
    data: Omit<T, 'id'>,
    select?: string[]
  }): Promise<T>;

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
}
```
</details>

<details>
<summary><b>Where Clause Interface</b></summary>

The `Where` interface is used for filtering records:

```typescript
interface Where {
  field: string
  value?: any
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'starts_with' | 'ends_with'
  connector?: 'AND' | 'OR'
}
```
</details>

<details>
<summary><b>Field Types and Attributes</b></summary>

When defining your schema, you can use the following field types and attributes:

```typescript
interface FieldAttribute {
  // The type of the field
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array'

  // Whether this field is required
  required?: boolean

  // Whether this field should be unique
  unique?: boolean

  // The actual column/field name in the database
  fieldName?: string

  // Whether this field can be sorted
  sortable?: boolean

  // Default value function
  defaultValue?: () => any

  // Reference to another model (for foreign keys)
  references?: {
    model: string
    field: string
    onDelete?: 'cascade' | 'set null' | 'restrict'
  }

  // Custom transformations
  transform?: {
    input?: (value: any) => any
    output?: (value: any) => any
  }
}
```
</details>

## 🤝 Contributing

Contributions are welcome! Feel free to [open issues](https://github.com/productdevbook/unadapter/issues) or [submit pull requests](https://github.com/productdevbook/unadapter/pulls) to help improve unadapter.

<details>
<summary><b>Development Setup</b></summary>

1. Clone the repository:
   ```bash
   git clone https://github.com/productdevbook/unadapter.git
   cd unadapter
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run tests:
   ```bash
   pnpm test
   ```

4. Build the project:
   ```bash
   pnpm build
   ```
</details>

## 🙏 Credits

This project draws inspiration and core concepts from:
- [better-auth](https://github.com/better-auth) - The original adapter architecture that inspired this project

## 📝 License

See the [LICENSE](LICENSE) file for details.

<div align="center">
  <p><i>unadapter is a work in progress. Stay tuned for updates!</i></p>
</div>

<!-- Links -->
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
