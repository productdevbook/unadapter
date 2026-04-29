// @ts-nocheck
import type { AdapterOptions } from "../../../src/types/index.ts"
import type { BetterAuthOptions } from "../../better-auth.schema.ts"
import fsPromises from "node:fs/promises"
import path from "node:path"
import Database from "better-sqlite3"
import merge from "deepmerge"
import knexFactory from "knex"
import { Kysely, MysqlDialect, SqliteDialect } from "kysely"
import { createPool } from "mysql2/promise"
import { afterAll, beforeAll, describe } from "vitest"
import { knexAdapter } from "../../../src/adapters/knex/index.ts"
import { getMigrations } from "../../../src/db/get-migration.ts"
import { getAuthTables } from "../../better-auth.schema.ts"
import { runAdapterTest } from "../../test.ts"
import { setState } from "../state.ts"

const sqliteFile = path.join(__dirname, "test.db")
const mysql = createPool("mysql://user:password@localhost:3306/better_auth")

const sqliteKnex = knexFactory({
  client: "better-sqlite3",
  connection: { filename: sqliteFile },
  useNullAsDefault: true,
})
const mysqlKnex = knexFactory({
  client: "mysql2",
  connection: "mysql://user:password@localhost:3306/better_auth",
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

describe("knex adapter test", async () => {
  beforeAll(async () => {
    setState("RUNNING")
    console.log(`Now running normal Knex adapter test...`)
    // Bootstrap schemas using a temporary Kysely connection (the existing migrator only supports Kysely).
    const sqliteDb = new Database(sqliteFile)
    const sqliteKy = new Kysely({ dialect: new SqliteDialect({ database: sqliteDb }) })
    const mysqlKy = new Kysely({ dialect: new MysqlDialect(mysql) })

    const sqliteOptionsBoot = opts({
      database: { db: sqliteKy, type: "sqlite" },
      isNumberIdTest: false,
    })
    const mysqlOptionsBoot = opts({
      database: { db: mysqlKy, type: "mysql" },
      isNumberIdTest: false,
    })
    await (await getMigrations(mysqlOptionsBoot, getAuthTables)).runMigrations()
    await (await getMigrations(sqliteOptionsBoot, getAuthTables)).runMigrations()
    await sqliteKy.destroy()
    await mysqlKy.destroy()
    sqliteDb.close()
  })

  afterAll(async () => {
    await sqliteKnex.destroy()
    await mysqlKnex.destroy()
    await mysql.query("DROP DATABASE IF EXISTS better_auth")
    await mysql.query("CREATE DATABASE better_auth")
    await mysql.end()
    await fsPromises.unlink(sqliteFile)
    setState("IDLE")
  })

  const mysqlOptions = opts({
    database: { db: null as any, type: "mysql" },
    isNumberIdTest: false,
  })
  const sqliteOptions = opts({
    database: { db: null as any, type: "sqlite" },
    isNumberIdTest: false,
  })

  const mysqlAdapter = knexAdapter(mysqlKnex, {
    type: "mysql",
    debugLogs: { isRunningAdapterTests: true },
  })
  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return mysqlAdapter(getAuthTables, merge(customOptions, mysqlOptions))
    },
    testPrefix: "knex-mysql",
  })

  const sqliteAdapter = knexAdapter(sqliteKnex, {
    type: "sqlite",
    debugLogs: { isRunningAdapterTests: true },
  })
  await runAdapterTest({
    getAdapter: async (customOptions = {}) => {
      return sqliteAdapter(getAuthTables, merge(customOptions, sqliteOptions))
    },
    testPrefix: "knex-sqlite",
  })
})
