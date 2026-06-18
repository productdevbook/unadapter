import type { Dialect } from "kysely"
import type { AdapterOptions, TablesSchema } from "../types/index.ts"
import { getMigrations } from "../db/get-migration.ts"

export type SQLDialect = "postgresql" | "mysql" | "sqlite"

export interface GenerateOptions {
  format?: "sql"
  dialect?: SQLDialect
}

/**
 * Build a driverless Kysely dialect for the target SQL flavour. The pool /
 * database handles are intentionally empty — `compileMigrations()` only
 * compiles SQL strings and never reaches the driver (same trick the
 * migration tests use), so generation needs no live connection.
 */
async function stubDialect(dialect: SQLDialect): Promise<Dialect> {
  const { PostgresDialect, MysqlDialect, SqliteDialect } = await import("kysely")
  switch (dialect) {
    case "mysql":
      return new MysqlDialect({ pool: {} as any })
    case "sqlite":
      return new SqliteDialect({ database: {} as any })
    default:
      return new PostgresDialect({ pool: {} as any })
  }
}

/**
 * Generate a database schema as a string, without a live database
 * connection. Intended for library authors exposing a `generate` command
 * in their own CLI.
 *
 * Reuses the same migration compile path as `getMigrations().compileMigrations()`
 * (id strategy is resolved from `options.advanced.database`), so generated
 * output matches what `runMigrations()` would actually create.
 */
export async function generate<T extends Record<string, any>>(
  getTables: (options: AdapterOptions<T>) => TablesSchema,
  options: AdapterOptions<T>,
  generateOptions: GenerateOptions = {},
): Promise<string> {
  const { dialect = "postgresql" } = generateOptions
  const database = (await stubDialect(dialect)) as AdapterOptions<T>["database"]
  const { compileMigrations } = await getMigrations({ ...options, database }, getTables, {
    skipIntrospect: true,
  })
  return compileMigrations()
}
