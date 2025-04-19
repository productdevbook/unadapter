import type { Dialect } from 'kysely'
import type { AdapterOptions } from '../../types/index.ts'
import type { KyselyDatabaseType } from './types.ts'
import { Kysely, MssqlDialect, MysqlDialect, PostgresDialect, SqliteDialect } from 'kysely'

function getDatabaseType(
  db: AdapterOptions['database'],
): KyselyDatabaseType | null {
  if (!db) {
    return null
  }
  if ('dialect' in db) {
    return getDatabaseType(db.dialect as Dialect)
  }
  if ('createDriver' in db) {
    if (db instanceof SqliteDialect) {
      return 'sqlite'
    }
    if (db instanceof MysqlDialect) {
      return 'mysql'
    }
    if (db instanceof PostgresDialect) {
      return 'postgres'
    }
    if (db instanceof MssqlDialect) {
      return 'mssql'
    }
  }
  if ('aggregate' in db) {
    return 'sqlite'
  }

  if ('getConnection' in db) {
    return 'mysql'
  }
  if ('connect' in db) {
    return 'postgres'
  }

  return null
}

export async function createKyselyAdapter<T extends Record<string, any>>(config: AdapterOptions<T>) {
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
    // @ts-expect-error - mysql2/promise connection object compatibility
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
