import type { Pool } from 'mysql2/promise'
import type { AdapterOptions } from 'unadapter/types'
import type { BetterAuthOptions } from '../better-auth.schema.ts'
import merge from 'deepmerge'
import { drizzle } from 'drizzle-orm/mysql2'
import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2/promise'
import { afterAll, beforeAll, describe } from 'vitest'
import { drizzleAdapter } from '../../src/adapters/drizzle/index.ts'
import { getMigrations } from '../../src/db/get-migration.ts'
import { getAuthTables } from '../better-auth.schema.ts'
import { runAdapterTest, runNumberIdAdapterTest } from '../test.ts'
import * as schema from './schema.mysql.ts'

const TEST_DB_MYSQL_URL = 'mysql://user:password@localhost:3306/better_auth'

const createTestPool = () => createPool(TEST_DB_MYSQL_URL)

function createKyselyInstance(pool: any) {
  return new Kysely({
    dialect: new MysqlDialect({ pool }),
  })
}

async function cleanupDatabase(mysql: Pool, shouldDestroy = true) {
  try {
    await mysql.query('DROP DATABASE IF EXISTS better_auth')
    await mysql.query('CREATE DATABASE better_auth')
    await mysql.query('USE better_auth')
  }
  catch (error) {
    console.log(error)
  }
  if (shouldDestroy) {
    await mysql.end()
  }
  else {
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

function createTestOptions(pool: any, useNumberId = false) {
  return ({
    database: pool,
    user: {
      fields: { email: 'email_address' },
      additionalFields: {
        test: {
          type: 'string',
          defaultValue: 'test',
        },
      },
    },
    advanced: {
      database: {
        useNumberId,
      },
    },
  }) satisfies AdapterOptions<BetterAuthOptions>
}

describe('drizzle Adapter Tests (MySQL)', async () => {
  const pool: any = createTestPool()
  const _mysql: Kysely<any> = createKyselyInstance(pool)

  const opts = createTestOptions(pool)
  const { runMigrations } = await getMigrations(opts, getAuthTables)
  await runMigrations()

  const db = drizzle({
    client: pool,
  })
  const adapter = drizzleAdapter(
    db,
    {
      provider: 'mysql',
      schema,
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )

  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const db = opts.database
      opts.database = undefined
      const merged = merge(opts, customOptions)
      merged.database = db
      return adapter(getAuthTables, merged)
    },
  })
})

describe('drizzle Adapter Number Id Test (MySQL)', async () => {
  const pool: any = createTestPool()
  const _mysql: Kysely<any> = createKyselyInstance(pool)
  const opts = createTestOptions(pool, true)

  beforeAll(async () => {
    await cleanupDatabase(pool, false)
    const { runMigrations } = await getMigrations(opts, getAuthTables)
    await runMigrations()
  })

  afterAll(async () => {
    await cleanupDatabase(pool)
  })

  const db = drizzle({
    client: pool,
  })
  const adapter = drizzleAdapter(
    db,
    {
      provider: 'mysql',
      schema,
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )

  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const db = opts.database
      opts.database = undefined
      const merged = merge(opts, customOptions)
      merged.database = db
      return adapter(getAuthTables, merged)
    },
  })
})
