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

/**
 * This type is used for backwards compatibility.
 * It represents any configuration object that can be passed to adapters or functions.
 */
export type AnyOptions = Record<string, any>
