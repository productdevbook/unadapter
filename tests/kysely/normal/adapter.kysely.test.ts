// @ts-nocheck - Test dosyasında tip kontrolleri devre dışı bırakıldı
import type { AdapterOptions } from 'unadapter/types'
import type { BetterAuthOptions } from '../../better-auth.schema.ts'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import merge from 'deepmerge'
import { Kysely, MssqlDialect, MysqlDialect, sql, SqliteDialect } from 'kysely'
import { createPool } from 'mysql2/promise'
import * as tarn from 'tarn'

import * as tedious from 'tedious'
import { afterAll, beforeAll, describe } from 'vitest'
import { kyselyAdapter } from '../../../src/adapters/kysely/index.ts'
import { getMigrations } from '../../../src/db/get-migration.ts'
import { getAuthTables } from '../../better-auth.schema.ts'
import { runAdapterTest } from '../../test.ts'
import { setState } from '../state.ts'

const sqlite = new Database(path.join(__dirname, 'test.db'))
const mysql = createPool('mysql://user:password@localhost:3306/better_auth')
const sqliteKy = new Kysely({
  dialect: new SqliteDialect({
    database: sqlite,
  }),
})
const mysqlKy = new Kysely({
  dialect: new MysqlDialect(mysql),
})
export function opts({
  database,
  isNumberIdTest,
}: { database: AdapterOptions['database'], isNumberIdTest: boolean }) {
  return ({
    database,
    user: {
      fields: {
        email: 'email_address',
      },
      additionalFields: {
        test: {
          type: 'string',
          defaultValue: 'test',
        },
      },
    },

    advanced: {
      database: {
        useNumberId: isNumberIdTest,
      },
    },
  }) satisfies AdapterOptions<BetterAuthOptions>
}

describe('adapter test', async () => {
  const mysqlOptions = opts({
    database: {
      db: mysqlKy,
      type: 'mysql',
    },
    isNumberIdTest: false,
  })

  const sqliteOptions = opts({
    database: {
      db: sqliteKy,
      type: 'sqlite',
    },
    isNumberIdTest: false,
  })
  beforeAll(async () => {
    setState('RUNNING')
    console.log(`Now running Number ID Kysely adapter test...`)
    await (await getMigrations(mysqlOptions, getAuthTables)).runMigrations()
    await (await getMigrations(sqliteOptions, getAuthTables)).runMigrations()
  })

  afterAll(async () => {
    await mysql.query('DROP DATABASE IF EXISTS better_auth')
    await mysql.query('CREATE DATABASE better_auth')
    await mysql.end()
    await fsPromises.unlink(path.join(__dirname, 'test.db'))
  })

  const mysqlAdapter = kyselyAdapter(
    mysqlKy,
    getAuthTables,
    {
      type: 'mysql',
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )
  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return mysqlAdapter(merge(customOptions, mysqlOptions))
    },
    testPrefix: 'mysql',
  })

  const sqliteAdapter = kyselyAdapter(
    sqliteKy,
    getAuthTables,
    {
      type: 'sqlite',
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )
  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return sqliteAdapter(merge(customOptions, sqliteOptions))
    },
    testPrefix: 'sqlite',
  })
})

describe('mssql', async () => {
  const dialect = new MssqlDialect({
    tarn: {
      ...tarn,
      options: {
        min: 0,
        max: 10,
      },
    },
    tedious: {
      ...tedious,
      connectionFactory: () =>
        new tedious.Connection({
          authentication: {
            options: {
              password: 'Password123!',
              userName: 'sa',
            },
            type: 'default',
          },
          options: {
            port: 1433,
            trustServerCertificate: true,
          },
          server: 'localhost',
        }),
    },
  })
  const opts = {
    database: dialect,
    user: {
      modelName: 'users',
    },
  } satisfies AdapterOptions<BetterAuthOptions>
  beforeAll(async () => {
    const { runMigrations, toBeAdded, toBeCreated } = await getMigrations(opts, getAuthTables)
    await runMigrations()
    return async () => {
      await resetDB()
      console.log(
        `Normal Kysely adapter test finished. Now allowing number ID Kysely tests to run.`,
      )
      setState('IDLE')
    }
  })
  const mssql = new Kysely({
    dialect,
  })
  const getAdapter = kyselyAdapter(
    mssql,
    getAuthTables,
    {
      type: 'mssql',
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )

  async function resetDB() {
    await sql`DROP TABLE dbo.verification;`.execute(mssql)
    await sql`DROP TABLE dbo.account;`.execute(mssql)
    await sql`DROP TABLE dbo.users;`.execute(mssql)
  }

  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      // const merged = merge( customOptions,opts);
      // merged.database = opts.database;
      return getAdapter(opts)
    },
    disableTests: {
      SHOULD_PREFER_GENERATE_ID_IF_PROVIDED: true,
    },
  })
})
