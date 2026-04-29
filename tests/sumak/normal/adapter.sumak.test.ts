// @ts-nocheck
import type { AdapterOptions } from "../../../src/types/index.ts"
import type { BetterAuthOptions } from "../../better-auth.schema.ts"
import fsPromises from "node:fs/promises"
import path from "node:path"
import Database from "better-sqlite3"
import merge from "deepmerge"
import { createPool } from "mysql2/promise"
import { mysqlDialect, sqliteDialect, sumak } from "sumak"
import { betterSqlite3Driver } from "sumak/drivers/better-sqlite3"
import { mysql2Driver } from "sumak/drivers/mysql2"
import { afterAll, beforeAll, describe } from "vitest"
import { sumakAdapter } from "../../../src/adapters/sumak/index.ts"
import { getMigrations } from "../../../src/db/get-migration.ts"
import { getAuthTables } from "../../better-auth.schema.ts"
import { runAdapterTest } from "../../test.ts"
import { isolatedMysqlDb } from "../../utils/mysql.ts"

const sqliteFile = path.join(__dirname, "test.db")
const mysqlIso = isolatedMysqlDb("sumak_normal")

const sqliteHandle = new Database(sqliteFile)
const sumakSqlite = sumak({
  dialect: sqliteDialect(),
  driver: betterSqlite3Driver(sqliteHandle),
  tables: {} as any,
}) as any

let mysqlPool: ReturnType<typeof createPool>
let sumakMysql: any

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

describe("sumak adapter test", async () => {
  beforeAll(async () => {
    console.log(`Now running normal Sumak adapter test...`)
    await mysqlIso.setup()
    mysqlPool = createPool(mysqlIso.url)
    sumakMysql = sumak({
      dialect: mysqlDialect(),
      driver: mysql2Driver(mysqlPool),
      tables: {} as any,
    }) as any

    const sqliteFactory = sumakAdapter(sumakSqlite, { type: "sqlite" })
    const mysqlFactory = sumakAdapter(sumakMysql, { type: "mysql" })

    const sqliteOptions = opts({
      database: sqliteFactory as any,
      isNumberIdTest: false,
    })
    const mysqlOptions = opts({
      database: mysqlFactory as any,
      isNumberIdTest: false,
    })

    await (await getMigrations(sqliteOptions, getAuthTables)).runMigrations()
    await (await getMigrations(mysqlOptions, getAuthTables)).runMigrations()
  })

  afterAll(async () => {
    sqliteHandle.close()
    if (mysqlPool) await mysqlPool.end()
    await mysqlIso.teardown()
    await fsPromises.unlink(sqliteFile)
  })

  const mysqlOptions = opts({
    database: { db: null as any, type: "mysql" },
    isNumberIdTest: false,
  })
  const sqliteOptions = opts({
    database: { db: null as any, type: "sqlite" },
    isNumberIdTest: false,
  })

  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const factory = sumakAdapter(sumakMysql, {
        type: "mysql",
        debugLogs: { isRunningAdapterTests: true },
      })
      return factory(getAuthTables, merge(customOptions, mysqlOptions))
    },
    testPrefix: "sumak-mysql",
  })

  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      const factory = sumakAdapter(sumakSqlite, {
        type: "sqlite",
        debugLogs: { isRunningAdapterTests: true },
      })
      return factory(getAuthTables, merge(customOptions, sqliteOptions))
    },
    testPrefix: "sumak-sqlite",
  })
})
