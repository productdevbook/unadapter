import type { Database } from 'better-sqlite3'
import type { Dialect, Kysely, MysqlPool, PostgresPool } from 'kysely'
import type { KyselyDatabaseType } from '../adapters/kysely/types.ts'
import type {
  LiteralUnion,
  Models,
} from '../types/index.ts'
import type { AdapterInstance } from './adapter.ts'

/**
 * Database connection types
 */
export type DatabaseConnection =
  | PostgresPool
  | MysqlPool
  | Database
  | Dialect
  | AdapterInstance
  | {
    dialect: Dialect
    type: KyselyDatabaseType
    casing?: 'snake' | 'camel'
  }
  | {
    db: Kysely<any>
    type: KyselyDatabaseType
    casing?: 'snake' | 'camel'
  }

export interface UnOptions {}

export interface AnyOptions extends UnOptions {
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
        model: LiteralUnion<Models, string>
        size?: number
      }) => string) | false
    }
    /**
     * Custom generateId function.
     *
     * If not provided, random ids will be generated.
     * If set to false, the database's auto generated id will be used.
     *
     * @deprecated Please use `database.generateId` instead. This will be potentially removed in future releases.
     */
    generateId?: ((options: {
      model: LiteralUnion<Models, string>
      size?: number
    }) => string) | false
  }
}
