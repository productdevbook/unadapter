import type { Dialect } from 'kysely'
import type { AnyOptions } from '../../types/index.ts'
import type { KyselyDatabaseType } from './types.ts'
import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } from 'kysely'

function getDatabaseType(
  db: AnyOptions['database'],
): KyselyDatabaseType | null {
  if (!db) {
    return null
  }

  if ('type' in db) {
    return db.type
  }

  if ('createDriver' in db) {
    return 'pg'
  }

  if ('aggregate' in db) {
    return 'sqlite'
  }

  if ('getConnection' in db) {
    return 'mysql'
  }

  if ('connect' in db) {
    return 'pg'
  }

  return null
}

export async function createKyselyAdapter(config: AnyOptions) {
  const db = config.database

  if (!db) {
    return {
      kysely: null,
      databaseType: null,
    }
  }

  if ('db' in db) {
    return {
      kysely: db.db,
      databaseType: db.type,
    }
  }

  if ('dialect' in db) {
    return {
      kysely: new Kysely<any>({ dialect: db.dialect }),
      databaseType: db.type,
    }
  }

  let dialect: Dialect | undefined

  const databaseType = getDatabaseType(db)

  if ('createDriver' in db) {
    dialect = db
  }

  if ('aggregate' in db) {
    dialect = new SqliteDialect({
      database: db,
    })
  }

  if ('getConnection' in db) {
    // @ts-ignore - mysql2/promise
    dialect = new MysqlDialect(db)
  }

  if ('connect' in db) {
    dialect = new PostgresDialect({
      pool: db,
    })
  }

  return {
    kysely: dialect ? new Kysely<any>({ dialect }) : null,
    databaseType,
  }
}
