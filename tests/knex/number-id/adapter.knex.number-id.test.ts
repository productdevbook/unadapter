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
import { runNumberIdAdapterTest } from "../../test.ts"

const sqliteFile = path.join(__dirname, "test.db")
const MYSQL_DB = "better_auth_knex_numid"
const mysqlAdmin = createPool("mysql://user:password@localhost:3306")
const mysql = createPool(`mysql://user:password@localhost:3306/${MYSQL_DB}`)

const sqliteKnex = knexFactory({
  client: "better-sqlite3",
  connection: { filename: sqliteFile },
  useNullAsDefault: true,
})
const mysqlKnex = knexFactory({
  client: "mysql2",
  connection: `mysql://user:password@localhost:3306/${MYSQL_DB}`,
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
    await mysqlAdmin.query(`DROP DATABASE IF EXISTS ${MYSQL_DB}`)
    await mysqlAdmin.query(`CREATE DATABASE ${MYSQL_DB}`)
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
    await mysql.end()
    await mysqlAdmin.query(`DROP DATABASE IF EXISTS ${MYSQL_DB}`)
    await mysqlAdmin.end()
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
