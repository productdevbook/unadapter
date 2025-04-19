import type { AdapterOptions } from 'unadapter/types'
import type { BetterAuthOptions } from '../better-auth.schema.ts'
import merge from 'deepmerge'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe } from 'vitest'
import { drizzleAdapter } from '../../src/adapters/drizzle/index.ts'
import { getMigrations } from '../../src/db/get-migration.ts'
import { getAuthTables } from '../better-auth.schema.ts'
import { runAdapterTest, runNumberIdAdapterTest } from '../test.ts'
import * as schema from './schema.ts'

const TEST_DB_URL = 'postgres://user:password@localhost:5432/better_auth'

const createTestPool = () => new Pool({ connectionString: TEST_DB_URL })

function createKyselyInstance(pool: Pool) {
  return new Kysely({
    dialect: new PostgresDialect({ pool }),
  })
}

async function cleanupDatabase(postgres: Kysely<any>, shouldDestroy = true) {
  await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(
    postgres,
  )
  if (shouldDestroy) {
    await postgres.destroy()
  }
}

function createTestOptions(pg: Pool, useNumberId = false) {
  return ({
    database: pg,
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

describe('drizzle Adapter Tests', async () => {
  const pg = createTestPool()
  const postgres = createKyselyInstance(pg)
  const opts = createTestOptions(pg)
  await cleanupDatabase(postgres, false)
  const { runMigrations } = await getMigrations(opts, getAuthTables)
  await runMigrations()

  afterAll(async () => {
    await cleanupDatabase(postgres)
  })
  const db = drizzle(pg)
  const adapter = drizzleAdapter(db, { provider: 'pg', schema })

  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const db = opts.database
      // @ts-expect-error - Temporarily unsetting database for merge
      opts.database = undefined
      const merged = merge(opts, customOptions)
      merged.database = db
      return adapter(getAuthTables, merged)
    },
  })
})

describe('drizzle Adapter Number Id Test', async () => {
  const pg = createTestPool()
  const postgres = createKyselyInstance(pg)
  const opts = createTestOptions(pg, true)
  beforeAll(async () => {
    await cleanupDatabase(postgres, false)
    const { runMigrations } = await getMigrations(opts, getAuthTables)
    await runMigrations()
  })

  afterAll(async () => {
    await cleanupDatabase(postgres)
  })
  const db = drizzle(pg)
  const adapter = drizzleAdapter(
    db,
    {
      provider: 'pg',
      schema,
      debugLogs: {
        isRunningAdapterTests: true,
      },
    },
  )

  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const db = opts.database
      // @ts-expect-error - Temporarily unsetting database for merge
      opts.database = undefined
      const merged = merge(opts, customOptions)
      merged.database = db
      return adapter(getAuthTables, merged)
    },
  })
})
