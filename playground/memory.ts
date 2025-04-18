import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
import { memoryAdapter } from 'unadapter/memory'

const db = {
  user: [],
  session: [],
}
// Initialize the adapter

interface CreateAdapter<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
  Models extends Record<string, any> = Record<string, any>,
> {
  tables: (options: AdapterOptions) => Schema
}

function createAdapter<
  T extends Record<string, any>,
  Schema extends UnDbSchema = UnDbSchema,
  Models extends Record<string, any> = Record<string, any>,
>(options: CreateAdapter<T, Schema, Models>) {
  const createAdapter = memoryAdapter(
    db,
    options.tables,
    {},
  )
  // Create an adapter instance
  const adapter = createAdapter({})
  return adapter
}

const adapter = createAdapter({
  tables: (options?: AdapterOptions) => {
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
          updatedAt: {
            type: 'date',
            defaultValue: () => new Date(),
            required: true,
            fieldName: options?.user?.fields?.updatedAt || 'updatedAt',
          },
        },
      },
    } satisfies UnDbSchema
  },
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
