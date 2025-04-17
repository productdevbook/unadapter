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
![Lines](https://img.shields.io/badge/Lines-75.79%25-yellowgreen)
![Statements](https://img.shields.io/badge/Statements-75.79%25-yellowgreen)
![Functions](https://img.shields.io/badge/Functions-78.01%25-yellowgreen)
![Branches](https://img.shields.io/badge/Branches-75.54%25-yellowgreen)

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
    <td><b><a href="https://www.prisma.io/">Prisma Adapter</a></td>
    <td>For Prisma ORM</td>
    <td>✅ Ready</td>
  </tr>
  <tr>
    <td><b><a href="https://www.mongodb.com/">MongoDB Adapter</a></td>
    <td>For MongoDB</td>
    <td>✅ Ready</td>
  </tr>
  <tr>
    <td><b><a href="https://orm.drizzle.team/">Drizzle Adapter</a></td>
    <td>For Drizzle ORM</td>
    <td>✅ Ready</td>
  </tr>
  <tr>
    <td><b><a href="https://kysely.dev/">Kysely Adapter</a></td>
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
- 🏗️ Fully customizable schema definition

## 🚀 Getting Started

### Basic Usage

```typescript
import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
import { memoryAdapter } from 'unadapter/memory'

// Create an in-memory database for testing
const db = {
  user: [],
  session: []
}

// Define a schema builder function
function getTables(options: AdapterOptions): UnDbSchema {
  return {
    user: {
      modelName: 'user',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options.user?.fields?.name || 'name',
          sortable: true,
        },
        email: {
          type: 'string',
          unique: true,
          required: true,
          fieldName: options.user?.fields?.email || 'email',
          sortable: true,
        },
        emailVerified: {
          type: 'boolean',
          defaultValue: () => false,
          required: true,
          fieldName: options.user?.fields?.emailVerified || 'emailVerified',
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          required: true,
          fieldName: options.user?.fields?.createdAt || 'createdAt',
        },
        updatedAt: {
          type: 'date',
          defaultValue: () => new Date(),
          required: true,
          fieldName: options.user?.fields?.updatedAt || 'updatedAt',
        },
      },
    },
  }
}

// Initialize the adapter
const createAdapter = memoryAdapter(
  db,
  getTables,
  {} // Additional adapter options
)

// Create an adapter instance
const adapter = createAdapter({})

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

### Using Custom Schema

unadapter allows you to define your own database schema. This gives you full control over your data models and their relationships.

```typescript
import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
import { memoryAdapter } from 'unadapter/memory'

// Create an in-memory database for testing
const db = {
  users: [],
  products: []
}

// Define a schema builder function
function getTables(options: AdapterOptions): UnDbSchema {
  return {
    user: {
      modelName: 'users', // The actual table/collection name in your database
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options.user?.fields?.name || 'full_name', // The actual column name in your database
          sortable: true
        },
        email: {
          type: 'string',
          unique: true,
          required: true,
          fieldName: options.user?.fields?.email || 'email_address'
        },
        role: {
          type: 'string',
          required: true,
          fieldName: options.user?.fields?.role || 'role',
          defaultValue: () => 'user'
        },
        isActive: {
          type: 'boolean',
          fieldName: options.user?.fields?.isActive || 'is_active',
          defaultValue: () => true
        },
        lastLogin: {
          type: 'date',
          required: false,
          fieldName: options.user?.fields?.lastLogin || 'last_login'
        },
        createdAt: {
          type: 'date',
          fieldName: options.user?.fields?.createdAt || 'created_at',
          defaultValue: () => new Date()
        },
        updatedAt: {
          type: 'date',
          fieldName: options.user?.fields?.updatedAt || 'updated_at',
          defaultValue: () => new Date()
        }
      }
    },
    product: {
      modelName: 'products',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options.product?.fields?.name || 'name'
        },
        price: {
          type: 'number',
          required: true,
          fieldName: options.product?.fields?.price || 'price'
        },
        description: {
          type: 'string',
          required: false,
          fieldName: options.product?.fields?.description || 'description'
        },
        userId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id',
            onDelete: 'cascade'
          },
          required: true,
          fieldName: options.product?.fields?.userId || 'user_id'
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: options.product?.fields?.createdAt || 'created_at'
        },
        updatedAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: options.product?.fields?.updatedAt || 'updated_at'
        }
      }
    }
  }
}

// Initialize the adapter
const createAdapter = memoryAdapter(
  db,
  getTables,
  {} // Additional adapter options
)

// Create an adapter instance
const adapter = createAdapter({})

// Now you can use the adapter with your custom schema
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin'
  }
})

// Create a product linked to the user
const product = await adapter.create({
  model: 'product',
  data: {
    name: 'Awesome Product',
    price: 99.99,
    description: 'This is an awesome product',
    userId: user.id
  }
})
```

### Field Types and Attributes

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

  // Custom validators
  validator?: {
    input?: any
    output?: any
  }

  // Whether this field should be returned in queries
  returned?: boolean

  // Whether this field can be used in input operations
  input?: boolean
}
```

### Using MongoDB Adapter with Custom Schema

```typescript
import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
import { MongoClient } from 'mongodb'
import { mongodbAdapter } from 'unadapter/mongodb'

// Create a database client
const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
const db = client.db('myDatabase')

// Define a schema builder function
function getTables(options: AdapterOptions): UnDbSchema {
  return {
    user: {
      modelName: 'users',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options.user?.fields?.name || 'name'
        },
        email: {
          type: 'string',
          required: true,
          unique: true,
          fieldName: options.user?.fields?.email || 'email'
        },
        settings: {
          type: 'json',
          required: false,
          fieldName: options.user?.fields?.settings || 'settings'
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: options.user?.fields?.createdAt || 'createdAt'
        }
      },
      order: 1
    }
  }
}

// Initialize the adapter
const createAdapter = mongodbAdapter(db, getTables)

// Create an adapter instance with options
const adapter = createAdapter({
  advanced: {
    database: {
      useNumberId: false
    }
  }
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

### Using Prisma Adapter with Custom Schema

```typescript
import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
import { PrismaClient } from '@prisma/client'
import { prismaAdapter } from 'unadapter/prisma'

// Initialize Prisma client
const prisma = new PrismaClient()

// Define a schema builder function
function getTables(options: AdapterOptions): UnDbSchema {
  return {
    user: {
      modelName: 'User', // Match your Prisma model name (case-sensitive)
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options.user?.fields?.name || 'name'
        },
        email: {
          type: 'string',
          required: true,
          unique: true,
          fieldName: options.user?.fields?.email || 'email'
        },
        profile: {
          type: 'json',
          required: false,
          fieldName: options.user?.fields?.profile || 'profile'
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: options.user?.fields?.createdAt || 'createdAt'
        }
      },
      order: 1
    },
    post: {
      modelName: 'Post',
      fields: {
        title: {
          type: 'string',
          required: true,
          fieldName: options.post?.fields?.title || 'title'
        },
        content: {
          type: 'string',
          required: false,
          fieldName: options.post?.fields?.content || 'content'
        },
        published: {
          type: 'boolean',
          defaultValue: () => false,
          fieldName: options.post?.fields?.published || 'published'
        },
        authorId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id',
            onDelete: 'cascade'
          },
          required: true,
          fieldName: options.post?.fields?.authorId || 'authorId'
        }
      },
      order: 2
    }
  }
}

// Initialize the adapter
const createAdapter = prismaAdapter(
  prisma,
  getTables,
  {
    provider: 'postgresql',
    debugLogs: true,
    usePlural: false
  }
)

// Create an adapter instance with options
const adapter = createAdapter({})

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

### Using Drizzle Adapter with Custom Schema

```typescript
import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
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

// Define a schema builder function
function getTables(options: AdapterOptions): UnDbSchema {
  return {
    user: {
      modelName: 'users',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options.user?.fields?.name || 'name'
        },
        email: {
          type: 'string',
          unique: true,
          required: true,
          fieldName: options.user?.fields?.email || 'email'
        },
        role: {
          type: 'string',
          defaultValue: () => 'user',
          fieldName: options.user?.fields?.role || 'role'
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: options.user?.fields?.createdAt || 'created_at'
        }
      },
      order: 1
    },
    task: {
      modelName: 'tasks',
      fields: {
        title: {
          type: 'string',
          required: true,
          fieldName: options.task?.fields?.title || 'title'
        },
        completed: {
          type: 'boolean',
          defaultValue: () => false,
          fieldName: options.task?.fields?.completed || 'completed'
        },
        userId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id'
          },
          required: true,
          fieldName: options.task?.fields?.userId || 'user_id'
        }
      },
      order: 2
    }
  }
}

// Initialize the adapter
const createAdapter = drizzleAdapter(
  db,
  getTables,
  {
    provider: 'mysql',
    defaultSchema: 'myapp'
  }
)

// Create an adapter instance
const adapter = createAdapter({})

// Use the adapter
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'admin'
  }
})

// Create a task for the user
const task = await adapter.create({
  model: 'task',
  data: {
    title: 'Complete project',
    userId: user.id
  }
})
```

### Using Kysely Adapter with Custom Schema

```typescript
import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
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

// Define a schema builder function
function getTables(options: AdapterOptions): UnDbSchema {
  return {
    user: {
      modelName: 'users',
      fields: {
        name: {
          type: 'string',
          required: true,
          fieldName: options.user?.fields?.name || 'name'
        },
        email: {
          type: 'string',
          required: true,
          unique: true,
          fieldName: options.user?.fields?.email || 'email'
        },
        active: {
          type: 'boolean',
          defaultValue: () => true,
          fieldName: options.user?.fields?.active || 'is_active'
        },
        meta: {
          type: 'json',
          required: false,
          fieldName: options.user?.fields?.meta || 'meta_data'
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          fieldName: options.user?.fields?.createdAt || 'created_at'
        }
      },
      order: 1
    },
    article: {
      modelName: 'articles',
      fields: {
        title: {
          type: 'string',
          required: true,
          fieldName: options.article?.fields?.title || 'title'
        },
        content: {
          type: 'string',
          required: true,
          fieldName: options.article?.fields?.content || 'content'
        },
        authorId: {
          type: 'string',
          references: {
            model: 'user',
            field: 'id',
            onDelete: 'cascade'
          },
          required: true,
          fieldName: options.article?.fields?.authorId || 'author_id'
        },
        tags: {
          type: 'array',
          required: false,
          fieldName: options.article?.fields?.tags || 'tags'
        },
        publishedAt: {
          type: 'date',
          required: false,
          fieldName: options.article?.fields?.publishedAt || 'published_at'
        }
      },
      order: 2
    }
  }
}

// Initialize the adapter
const createAdapter = kyselyAdapter(
  db,
  getTables,
  {
    defaultSchema: 'public'
  }
)

// Create an adapter instance
const adapter = createAdapter({})

// Use the adapter
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'Robert Chen',
    email: 'robert@example.com',
    meta: { interests: ['programming', 'reading'], location: 'San Francisco' }
  }
})

// Create an article by this user
const article = await adapter.create({
  model: 'article',
  data: {
    title: 'Working with Kysely',
    content: 'Kysely is a type-safe SQL query builder for TypeScript',
    authorId: user.id,
    tags: ['typescript', 'database', 'sql']
  }
})
```

### Creating Custom Adapters

You can create your own adapters using the `createAdapter` function:

```typescript
import { UnDbSchema } from 'unadapter'
import { createAdapter } from 'unadapter/create'

// Define a schema
const mySchema: UnDbSchema = {
  user: {
    modelName: 'user',
    fields: {
      name: { type: 'string', required: true },
      email: { type: 'string', required: true, unique: true },
      createdAt: { type: 'date', defaultValue: () => new Date() }
    },
    order: 1
  }
}

// Define options
const options = {
  user: {
    fields: {},
    additionalFields: {}
  },
  advanced: {
    database: {
      useNumberId: false
    }
  }
}

const myCustomAdapter = createAdapter({
  config: {
    adapterId: 'my-custom',
    adapterName: 'My Custom Adapter',
    usePlural: false,
    supportsJSON: true,
    supportsDates: true,
    supportsBooleans: true
  },
  adapter: ({ options, schema, getModelName, getFieldName }) => {
    // Your custom database implementation
    const db = {
      user: []
    }

    // Implement adapter methods
    return {
      async create({ model, data }) {
        // Add ID if not present
        const record = { id: crypto.randomUUID(), ...data }
        db[getModelName(model)].push(record)
        return record
      },

      async findOne({ model, where, select }) {
        const modelName = getModelName(model)
        const records = db[modelName]
        return records.find((record) => {
          return where.every((condition) => {
            const { field, value, operator = 'eq' } = condition
            const fieldName = getFieldName({ model, field })
            if (operator === 'eq')
              return record[fieldName] === value
            // Implement other operators as needed
            return false
          })
        }) || null
      },

      async findMany({ model, where, limit, sortBy, offset }) {
        // Your implementation here
        return []
      },

      async update({ model, where, update }) {
        // Your implementation here
        return null
      },

      async updateMany({ model, where, update }) {
        // Your implementation here
        return 0
      },

      async delete({ model, where }) {
        // Your implementation here
      },

      async deleteMany({ model, where }) {
        // Your implementation here
        return 0
      },

      async count({ model, where }) {
        // Your implementation here
        return 0
      }
    }
  }
})(options, mySchema)
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
  field: string
  value?: any
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'starts_with' | 'ends_with'
  connector?: 'AND' | 'OR'
}
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
