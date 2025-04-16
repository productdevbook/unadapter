import type { Database } from 'better-sqlite3'
import type { Dialect, Kysely, MysqlPool, PostgresPool } from 'kysely'
import type { KyselyDatabaseType } from '../adapters/kysely/types.ts'
import type { FieldAttribute } from '../db/index.ts'
import type {
  Account,
  LiteralUnion,
  Models,
  OmitId,
  User,
  Verification,
} from '../types/index.ts'
import type { Logger } from '../utils/index.ts'
import type { AdapterInstance, SecondaryStorage } from './adapter.ts'
import type { AuthPluginSchema } from './plugins.ts'

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
    schema?: AuthPluginSchema
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
   * Database configuration
   */
  database?:
    | PostgresPool
    | MysqlPool
    | Database
    | Dialect
    | AdapterInstance
    | {
      dialect: Dialect
      type: KyselyDatabaseType
      /**
       * casing for table names
       *
       * @default "camel"
       */
      casing?: 'snake' | 'camel'
    }
    | {
      /**
       * Kysely instance
       */
      db: Kysely<any>
      /**
       * Database type between postgres, mysql and sqlite
       */
      type: KyselyDatabaseType
      /**
       * casing for table names
       *
       * @default "camel"
       */
      casing?: 'snake' | 'camel'
    }
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
  /**
   * Advanced options
   */
  advanced?: {
    /**
     * Database configuration.
     */
    database?: {
      /**
       * The default number of records to return from the database
       * when using the `findMany` adapter method.
       *
       * @default 100
       */
      defaultFindManyLimit?: number
      /**
       * If your database auto increments number ids, set this to `true`.
       *
       * Note: If enabled, we will not handle ID generation (including if you use `generateId`), and it would be expected that your database will provide the ID automatically.
       *
       * @default false
       */
      useNumberId?: boolean
      /**
       * Custom generateId function.
       *
       * If not provided, random ids will be generated.
       * If set to false, the database's auto generated id will be used.
       */
      generateId?: | ((options: {
        model: LiteralUnion<Models, string>
        size?: number
      }) => string)
      | false
    }
    /**
     * Custom generateId function.
     *
     * If not provided, random ids will be generated.
     * If set to false, the database's auto generated id will be used.
     *
     * @deprecated Please use `database.generateId` instead. This will be potentially removed in future releases.
     */
    generateId?: | ((options: {
      model: LiteralUnion<Models, string>
      size?: number
    }) => string)
    | false
  }
  logger?: Logger
}
