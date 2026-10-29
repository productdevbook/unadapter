// @ts-nocheck
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import Database from "better-sqlite3"
import knex from "knex"
import { Kysely, SqliteDialect } from "kysely"
import { sqliteDialect, sumak } from "sumak"
import { betterSqlite3Driver } from "sumak/drivers/better-sqlite3"
import { describe, expect, onTestFinished, test } from "vitest"
import { knexAdapter } from "../src/adapters/knex/index.ts"
import { kyselyAdapter } from "../src/adapters/kysely/index.ts"
import { sumakAdapter } from "../src/adapters/sumak/index.ts"
import { createAdapter } from "../src/index.ts"

// Boolean / date where values must be converted for SQLite even when the
// table name differs from the schema key (usePlural or a custom modelName).
const cases = [
  { label: "usePlural", modelName: "user", table: "users", usePlural: true },
  { label: "custom modelName", modelName: "app_users", table: "app_users", usePlural: false },
]

const factories = {
  kysely: (sqlite, usePlural) =>
    kyselyAdapter(new Kysely({ dialect: new SqliteDialect({ database: sqlite }) }), {
      type: "sqlite",
      usePlural,
    }),
  knex: (sqlite, usePlural) =>
    knexAdapter(
      knex({
        client: "better-sqlite3",
        connection: { filename: sqlite.name },
        useNullAsDefault: true,
      }),
      { type: "sqlite", usePlural },
    ),
  sumak: (sqlite, usePlural) =>
    sumakAdapter(
      sumak({ dialect: sqliteDialect(), driver: betterSqlite3Driver(sqlite), tables: {} }),
      { type: "sqlite", usePlural },
    ),
}

describe.each(Object.entries(factories))("%s adapter model name mapping", (_, factory) => {
  test.each(cases)("where on boolean/date fields with $label", async (c) => {
    // A real file so the knex factory can open the same database.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unadapter-"))
    onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }))
    const sqlite = new Database(path.join(dir, "test.db"))
    sqlite.exec(
      `create table ${c.table} (id text primary key, email text, verified integer, joined date)`,
    )
    const tables = () => ({
      user: {
        modelName: c.modelName,
        fields: {
          email: { type: "string" },
          verified: { type: "boolean", required: false },
          joined: { type: "date", required: false },
        },
      },
    })
    const db = createAdapter(tables, { database: factory(sqlite, c.usePlural) })
    const joined = new Date("2026-01-01T00:00:00.000Z")
    const created = await db.create({
      model: "user",
      data: { email: "a@x.com", verified: true, joined },
    })
    await db.create({ model: "user", data: { email: "b@x.com", verified: false } })

    const verified = await db.findMany({
      model: "user",
      where: [{ field: "verified", value: true }],
    })
    expect(verified.map((u) => u.id)).toEqual([created.id])

    const byDate = await db.findMany({
      model: "user",
      where: [{ field: "joined", value: joined }],
    })
    expect(byDate.map((u) => u.id)).toEqual([created.id])
  })
})
