import type { Database } from 'better-sqlite3'
import type { Dialect, Kysely, MysqlPool, PostgresPool } from 'kysely'
import type { KyselyDatabaseType } from '../adapters/kysely/types.ts'
import type {
  AdapterInstance,
  LiteralUnion,
  TablesSchema,
} from '../types/index.ts'

export interface UnOptions {}

export type AdapterOptions<
  T extends Record<string, any> = Record<string, any>,
  _Schema extends TablesSchema = TablesSchema,
> = T & UnOptions & {
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
      generateId?: ((options: {
        model: LiteralUnion<any, string>
        size?: number
      }) => string) | false
    }
  }

  database?:
    | PostgresPool
    | MysqlPool
    | Database
    | Dialect
    | AdapterInstance<T>
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
}
