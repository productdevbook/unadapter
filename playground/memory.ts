import type { AdapterOptions, UnDbSchema } from 'unadapter/types'
import { memoryAdapter } from 'unadapter/memory'

const db = {
  user: [],
  session: [],
}

export function getTables(options?: AdapterOptions) {
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
        image: {
          type: 'string',
          required: false,
          fieldName: options.user?.fields?.image || 'image',
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
  } satisfies UnDbSchema
}


// Initialize the adapter
const createAdapter = memoryAdapter(
  db,
  getTables,
  {},
)

// Create an adapter instance
const adapter = createAdapter({})

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

console.log('Created user:', user, db)
