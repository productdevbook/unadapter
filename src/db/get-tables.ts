import type { BetterAuthOptions } from '../types/index.ts'
import type { FieldAttribute } from './index.ts'

export type BetterAuthDbSchema = Record<
  string,
  {
    /**
     * The name of the table in the database
     */
    modelName: string
    /**
     * The fields of the table
     */
    fields: Record<string, FieldAttribute>
    /**
     * Whether to disable migrations for this table
     * @default false
     */
    disableMigrations?: boolean
    /**
     * The order of the table
     */
    order?: number
  }
>

export function getAuthTables(options: BetterAuthOptions): BetterAuthDbSchema {
  const pluginSchema = options.plugins?.reduce(
    (acc, plugin) => {
      const schema = plugin.schema
      if (!schema)
        return acc
      for (const [key, value] of Object.entries(schema)) {
        acc[key] = {
          fields: {
            ...acc[key]?.fields,
            ...value.fields,
          },
          modelName: value.modelName || key,
        }
      }
      return acc
    },
    {} as Record<
      string,
      { fields: Record<string, FieldAttribute>, modelName: string }
    >,
  )

  const { user, account, ...pluginTables } = pluginSchema || {}

  return {
    user: {
      modelName: options.user?.modelName || 'user',
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
        ...user?.fields,
        ...options.user?.additionalFields,
      },
      order: 1,
    },
    account: {
      modelName: options.account?.modelName || 'account',
      fields: {
        accountId: {
          type: 'string',
          required: true,
          fieldName: options.account?.fields?.accountId || 'accountId',
        },
        providerId: {
          type: 'string',
          required: true,
          fieldName: options.account?.fields?.providerId || 'providerId',
        },
        userId: {
          type: 'string',
          references: {
            model: options.user?.modelName || 'user',
            field: 'id',
            onDelete: 'cascade',
          },
          required: true,
          fieldName: options.account?.fields?.userId || 'userId',
        },
        accessToken: {
          type: 'string',
          required: false,
          fieldName: options.account?.fields?.accessToken || 'accessToken',
        },
        refreshToken: {
          type: 'string',
          required: false,
          fieldName: options.account?.fields?.refreshToken || 'refreshToken',
        },
        idToken: {
          type: 'string',
          required: false,
          fieldName: options.account?.fields?.idToken || 'idToken',
        },
        accessTokenExpiresAt: {
          type: 'date',
          required: false,
          fieldName: options.account?.fields?.accessTokenExpiresAt
            || 'accessTokenExpiresAt',
        },
        refreshTokenExpiresAt: {
          type: 'date',
          required: false,
          fieldName: options.account?.fields?.accessTokenExpiresAt
            || 'refreshTokenExpiresAt',
        },
        scope: {
          type: 'string',
          required: false,
          fieldName: options.account?.fields?.scope || 'scope',
        },
        password: {
          type: 'string',
          required: false,
          fieldName: options.account?.fields?.password || 'password',
        },
        createdAt: {
          type: 'date',
          required: true,
          fieldName: options.account?.fields?.createdAt || 'createdAt',
        },
        updatedAt: {
          type: 'date',
          required: true,
          fieldName: options.account?.fields?.updatedAt || 'updatedAt',
        },
        ...account?.fields,
      },
      order: 3,
    },
    verification: {
      modelName: options.verification?.modelName || 'verification',
      fields: {
        identifier: {
          type: 'string',
          required: true,
          fieldName: options.verification?.fields?.identifier || 'identifier',
        },
        value: {
          type: 'string',
          required: true,
          fieldName: options.verification?.fields?.value || 'value',
        },
        expiresAt: {
          type: 'date',
          required: true,
          fieldName: options.verification?.fields?.expiresAt || 'expiresAt',
        },
        createdAt: {
          type: 'date',
          required: false,
          defaultValue: () => new Date(),
          fieldName: options.verification?.fields?.createdAt || 'createdAt',
        },
        updatedAt: {
          type: 'date',
          required: false,
          defaultValue: () => new Date(),
          fieldName: options.verification?.fields?.updatedAt || 'updatedAt',
        },
      },
      order: 4,
    },
    ...pluginTables,
  } satisfies BetterAuthDbSchema
}
