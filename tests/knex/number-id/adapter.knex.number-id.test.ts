// @ts-nocheck
import type { AdapterOptions } from "../../../src/types/index.ts"
import type { BetterAuthOptions } from "../../better-auth.schema.ts"
import fs from "node:fs"
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
import { runNumberIdAdapterTest } from "../../test.ts"
import { getState, stateFilePath } from "../state.ts"

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

describe("knex number id adapter tests", async () => {
  beforeAll(async () => {
    await new Promise((resolve) => {
      const checkState = async () => {
        await new Promise((r) => setTimeout(r, 800))
        if (getState() === "IDLE") {
          resolve(true)
          return
        }
        console.log(`Waiting for state to be IDLE...`)
        fs.watch(stateFilePath, () => {
          if (getState() === "IDLE") {
            resolve(true)
          }
        })
      }

      checkState()
    })
    console.log(`Now running Number ID Knex adapter test...`)
    const sqliteDb = new Database(sqliteFile)
    const sqliteKy = new Kysely({ dialect: new SqliteDialect({ database: sqliteDb }) })
    const mysqlKy = new Kysely({ dialect: new MysqlDialect(mysql) })

    const sqliteOptionsBoot = opts({
      database: { db: sqliteKy, type: "sqlite" },
      isNumberIdTest: true,
    })
    const mysqlOptionsBoot = opts({
      database: { db: mysqlKy, type: "mysql" },
      isNumberIdTest: true,
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
