import type {
  Account,
  DbSchema,
  FieldAttribute,
  OmitId,
  SecondaryStorage,
  UnDbSchema,
  User,
  Verification,
} from 'unadapter/types'

export interface BetterAuthOptions {
  /**
   * The name of the application
   *
   * process.env.APP_NAME
   *
   * @default "Better Auth"
   */
  appName?: string

  plugins?: {
    schema?: Omit<DbSchema, 'order'>
  }[]
  /**
   * Base URL for the Better Auth. This is typically the
   * root URL where your application server is hosted.
   * If not explicitly set,
   * the system will check the following environment variable:
   *
   * process.env.BETTER_AUTH_URL
   *
   * If not set it will throw an error.
   */
  baseURL?: string
  /**
   * Base path for the Better Auth. This is typically
   * the path where the
   * Better Auth routes are mounted.
   *
   * @default "/api/auth"
   */
  basePath?: string
  /**
   * The secret to use for encryption,
   * signing and hashing.
   *
   * By default Better Auth will look for
   * the following environment variables:
   * process.env.BETTER_AUTH_SECRET,
   * process.env.AUTH_SECRET
   * If none of these environment
   * variables are set,
   * it will default to
   * "better-auth-secret-123456789".
   *
   * on production if it's not set
   * it will throw an error.
   *
   * you can generate a good secret
   * using the following command:
   * @example
   * ```bash
   * openssl rand -base64 32
   * ```
   */
  secret?: string

  /**
   * Secondary storage configuration
   *
   * This is used to store session and rate limit data.
   */
  secondaryStorage?: SecondaryStorage

  account?: {
    modelName?: string
    fields?: Partial<Record<keyof OmitId<Account>, string>>
  }

  /**
   * User configuration
   */
  user?: {
    /**
     * The model name for the user. Defaults to "user".
     */
    modelName?: string
    /**
     * Map fields
     *
     * @example
     * ```ts
     * {
     *  userId: "user_id"
     * }
     * ```
     */
    fields?: Partial<Record<keyof OmitId<User>, string>>
    /**
     * Additional fields for the session
     */
    additionalFields?: {
      [key: string]: FieldAttribute
    }
  }
  /**
   * Verification configuration
   */
  verification?: {
    /**
     * Change the modelName of the verification table
     */
    modelName?: string
    /**
     * Map verification fields
     */
    fields?: Partial<Record<keyof OmitId<Verification>, string>>
  }
}

export function getAuthTables(options: BetterAuthOptions): UnDbSchema {
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
  } satisfies UnDbSchema
}
