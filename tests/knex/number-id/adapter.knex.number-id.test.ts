// @ts-nocheck
import type { AdapterOptions } from "../../../src/types/index.ts"
import type { BetterAuthOptions } from "../../better-auth.schema.ts"
import fsPromises from "node:fs/promises"
import path from "node:path"
import merge from "deepmerge"
import knexFactory from "knex"
import { afterAll, beforeAll, describe } from "vitest"
import { knexAdapter } from "../../../src/adapters/knex/index.ts"
import { getMigrations } from "../../../src/db/get-migration.ts"
import { getAuthTables } from "../../better-auth.schema.ts"
import { runNumberIdAdapterTest } from "../../test.ts"
import { isolatedMysqlDb } from "../../utils/mysql.ts"

const sqliteFile = path.join(__dirname, "test.db")
const mysqlIso = isolatedMysqlDb("knex_numid")

const sqliteKnex = knexFactory({
  client: "better-sqlite3",
  connection: { filename: sqliteFile },
  useNullAsDefault: true,
})
const mysqlKnex = knexFactory({
  client: "mysql2",
  connection: mysqlIso.url,
})

export function opts({
  database,
  isNumberIdTest,
}: {
  database: AdapterOptions["database"]
  isNumberIdTest: boolean
}): AdapterOptions<BetterAuthOptions> {
  return {
    database,
    user: {
      fields: {
        email: "email_address",
      },
      additionalFields: {
        test: {
          type: "string",
          defaultValue: "test",
        },
      },
    },
    advanced: {
      database: {
        useNumberId: isNumberIdTest,
      },
    },
  } as AdapterOptions<BetterAuthOptions>
}

describe("knex number id adapter tests", async () => {
  beforeAll(async () => {
    console.log(`Now running Number ID Knex adapter test...`)
    await mysqlIso.setup()

    const sqliteAdapterFactory = knexAdapter(sqliteKnex, { type: "sqlite" })
    const mysqlAdapterFactory = knexAdapter(mysqlKnex, { type: "mysql" })

    const sqliteOptions = opts({
      database: sqliteAdapterFactory as any,
      isNumberIdTest: true,
    })
    const mysqlOptions = opts({
      database: mysqlAdapterFactory as any,
      isNumberIdTest: true,
    })

    await (await getMigrations(sqliteOptions, getAuthTables)).runMigrations()
    await (await getMigrations(mysqlOptions, getAuthTables)).runMigrations()
  })

  afterAll(async () => {
    await sqliteKnex.destroy()
    await mysqlKnex.destroy()
    await mysqlIso.teardown()
    await fsPromises.unlink(sqliteFile)
  })

  const mysqlOptions = opts({
    database: { db: null as any, type: "mysql" },
    isNumberIdTest: true,
  })
  const sqliteOptions = opts({
    database: { db: null as any, type: "sqlite" },
    isNumberIdTest: true,
  })

  const mysqlAdapter = knexAdapter(mysqlKnex, {
    type: "mysql",
    debugLogs: { isRunningAdapterTests: false },
  })
  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return mysqlAdapter(getAuthTables, merge(customOptions, mysqlOptions))
    },
    testPrefix: "knex-mysql",
  })

  const sqliteAdapter = knexAdapter(sqliteKnex, {
    type: "sqlite",
    debugLogs: { isRunningAdapterTests: false },
  })
  await runNumberIdAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return sqliteAdapter(getAuthTables, merge(customOptions, sqliteOptions))
    },
    testPrefix: "knex-sqlite",
  })
})
