// @ts-nocheck
import type { AdapterOptions } from 'unadapter/types'
import type { BetterAuthOptions } from '../../better-auth.schema.ts'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import merge from 'deepmerge'
import { Kysely, MysqlDialect, SqliteDialect } from 'kysely'
import { createPool } from 'mysql2/promise'
import { afterAll, beforeAll, describe } from 'vitest'
import { kyselyAdapter } from '../../../src/adapters/kysely/index.ts'
import { getMigrations } from '../../../src/db/get-migration.ts'
import { getAuthTables } from '../../better-auth.schema.ts'
import { runNumberIdAdapterTest } from '../../test.ts'
import { getState, stateFilePath } from '../state.ts'

export function opts({
  database,
  isNumberIdTest,
}: { database: AdapterOptions['database'], isNumberIdTest: boolean }): AdapterOptions<BetterAuthOptions> {
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
  }) as AdapterOptions<BetterAuthOptions>
}

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

describe('number ID Adapter tests', async () => {
  const mysqlOptions = opts({
    database: {
      db: mysqlKy,
      type: 'mysql',
    },
    isNumberIdTest: true,
  })
  const sqliteOptions = opts({
    database: {
      db: sqliteKy,
      type: 'sqlite',
    },
    isNumberIdTest: true,
  })

  beforeAll(async () => {
    await new Promise((resolve) => {
      const checkState = async () => {
        await new Promise(r => setTimeout(r, 800))
        if (getState() === 'IDLE') {
          resolve(true)
          return
        }
        console.log(`Waiting for state to be IDLE...`)
        fs.watch(stateFilePath, () => {
          if (getState() === 'IDLE') {
            resolve(true)
          }
        })
      }

      checkState()
    })
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
        isRunningAdapterTests: false,
      },
    },
  )
  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const merged = merge(customOptions, mysqlOptions)
      return mysqlAdapter(merged)
    },
    testPrefix: 'mysql',
  })

  const sqliteAdapter = kyselyAdapter(
    sqliteKy,
    getAuthTables,
    {
      type: 'sqlite',
      debugLogs: {
        isRunningAdapterTests: false,
      },
    },
  )

  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return sqliteAdapter(merge(customOptions, sqliteOptions))
    },
    testPrefix: 'sqlite',
  })
})
