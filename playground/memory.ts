import type { PluginSchema } from 'unadapter/types'
import { createAdapter, createTable, mergePluginSchemas } from 'unadapter'
import { memoryAdapter } from 'unadapter/memory'

const db = {
  user: [],
  session: [],
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
  const { user, account, ..._pluginTables } = mergePluginSchemas<CustomOptions>(options) || {}

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
        image: {
          type: 'string',
          required: false,
          fieldName: options?.user?.fields?.image || 'image',
        },
        createdAt: {
          type: 'date',
          defaultValue: () => new Date(),
          required: true,
          fieldName: options?.user?.fields?.createdAt || 'createdAt',
        },
        ...user?.fields,
        ...options?.user?.fields,
      },
    },
  }
})
const adapter = createAdapter(tables, {
  database: memoryAdapter(
    db,
    {},
  ),
  plugins: [{
    schema: {
      user: {
        modelName: 'user',
        fields: {
          header: {
            type: 'string',
            required: true,
            fieldName: 'header',
          },
        },
      },
    },
  }],
})

// eslint-disable-next-line antfu/no-top-level-await
const user = await adapter.create({
  model: 'user',
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
})
// eslint-disable-next-line antfu/no-top-level-await
const _users = await adapter.findMany({
  model: 'user',
  where: [
    {
      field: 'email',
      value: 'john@example.com',
      operator: 'eq',
    },
  ],
})

console.log('Found users:', user, db)
