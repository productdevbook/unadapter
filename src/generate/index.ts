import type { AdapterOptions, TablesSchema } from "../types/index.ts"
import { getMigrations } from "../db/get-migration.ts"
import { generateDrizzle, type DrizzleGenerateOptions } from "./drizzle.ts"

export type { DrizzleDialect, DrizzleGenerateOptions } from "./drizzle.ts"

export type GenerateOptions = { format?: "sql" } | DrizzleGenerateOptions

/**
 * Compile the schema to SQL DDL or Drizzle schema source without connecting to
 * a database.
 *
 * For SQL, `options.database` must be an adapter instance (e.g.
 * `kyselyAdapter(db)`, `knexAdapter(db)`); the dialect is taken from it. For
 * Drizzle source generation, pass `{ format: "drizzle", dialect }` and no
 * database adapter is required. The id strategy is read from
 * `options.advanced.database`.
 *
 * @example
 * const sql = await generate(getTables, {
 *   database: kyselyAdapter(db, { type: "postgres" }),
 * })
 *
 * @throws if `options.database` is not an adapter instance.
 */
export async function generate<T extends Record<string, any>>(
  getTables: (options: AdapterOptions<T>) => TablesSchema,
  options: AdapterOptions<T>,
  generateOptions: GenerateOptions = {},
): Promise<string> {
  if (generateOptions.format === "drizzle") {
    return generateDrizzle(getTables, options, generateOptions)
  }

  const format = (generateOptions as { format?: string }).format
  if (format && format !== "sql") {
    throw new Error(
      `[unadapter] unsupported generate format "${format}". Only "sql" and "drizzle" are currently supported.`,
    )
  }
  if (typeof options.database !== "function") {
    throw new Error(
      "[unadapter] generate() requires an adapter instance as options.database " +
        "(e.g. kyselyAdapter(db), knexAdapter(db)). The adapter supplies the target " +
        "dialect and offline SQL compilation via its createMigrator().",
    )
  }
  const { compileMigrations } = await getMigrations(options, getTables, {
    skipIntrospect: true,
  })
  return compileMigrations()
}
