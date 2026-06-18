import type { AdapterOptions, TablesSchema } from "../types/index.ts"
import { getMigrations } from "../db/get-migration.ts"

export interface GenerateOptions {
  format?: "sql"
}

/**
 * Compile the schema to a SQL DDL string without connecting to a database.
 *
 * `options.database` must be an adapter instance (e.g. `kyselyAdapter(db)`,
 * `knexAdapter(db)`); the dialect is taken from it. The id strategy is read
 * from `options.advanced.database`.
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
  _generateOptions: GenerateOptions = {},
): Promise<string> {
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
