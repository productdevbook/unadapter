import type {
  AdapterInstance,
  AdapterMigrator,
  AdapterOptions,
  ColumnDefinition,
  FieldAttribute,
  TablesSchema,
} from "../types/index.ts"
import { createLogger } from "../utils/logger.ts"
import { getSchema } from "./get-schema.ts"

export interface GetMigrationsResult {
  toBeCreated: { table: string; fields: Record<string, FieldAttribute>; order: number }[]
  toBeAdded: { table: string; fields: Record<string, FieldAttribute>; order: number }[]
  runMigrations: () => Promise<void>
  compileMigrations: () => Promise<string>
}

function buildColumnDef(
  field: FieldAttribute,
  fieldName: string,
  migrator: AdapterMigrator,
  useNumberId: boolean,
): ColumnDefinition {
  return {
    type: migrator.resolveType(field, fieldName, { useNumberId }),
    notNull: field.required !== false,
    unique: field.unique,
    references: field.references
      ? { table: field.references.model, field: field.references.field }
      : undefined,
  }
}

function buildIdColumnDef(useNumberId: boolean, migrator: AdapterMigrator): ColumnDefinition {
  return {
    type: migrator.resolveType({ type: "string" } as FieldAttribute, "id", { useNumberId }),
    notNull: true,
    primaryKey: true,
    autoIncrement: useNumberId,
  }
}

/**
 * Adapter-agnostic migration engine. The adapter supplies introspection
 * and DDL via {@link AdapterMigrator}; this engine only does diffing
 * and ordering.
 *
 * Resolves the migrator from (in order):
 * 1. `config.database` if it's an `AdapterInstance` whose adapter exposes
 *    `createMigrator`.
 * 2. The Kysely adapter — for backwards compatibility with existing setups
 *    that pass a raw Kysely DB / Dialect / pool as `config.database`.
 */
export async function getMigrations<T extends Record<string, any>>(
  config: AdapterOptions<T>,
  getTables: (options: AdapterOptions<T>) => TablesSchema,
): Promise<GetMigrationsResult> {
  const schema = getSchema(config, getTables)
  const logger = createLogger(config.logger)
  const useNumberId = config.advanced?.database?.useNumberId === true

  const migrator = await resolveMigrator(config, getTables, logger)

  const tableMetadata = await migrator.introspect()

  const toBeCreated: GetMigrationsResult["toBeCreated"] = []
  const toBeAdded: GetMigrationsResult["toBeAdded"] = []

  for (const [key, value] of Object.entries(schema)) {
    const liveTable = tableMetadata.find((t) => t.name === key)
    if (!liveTable) {
      const tableData = {
        table: key,
        fields: value.fields,
        order: value.order || Infinity,
      }

      const tIndex = toBeCreated.findIndex((t) => t.table === key)
      const insertIndex = toBeCreated.findIndex((t) => (t.order || Infinity) > tableData.order)

      if (insertIndex === -1) {
        if (tIndex === -1) {
          toBeCreated.push(tableData)
        } else {
          toBeCreated[tIndex].fields = {
            ...toBeCreated[tIndex].fields,
            ...value.fields,
          }
        }
      } else {
        toBeCreated.splice(insertIndex, 0, tableData)
      }
      continue
    }

    const toBeAddedFields: Record<string, FieldAttribute> = {}
    for (const [fieldName, field] of Object.entries(value.fields)) {
      const column = liveTable.columns.find((c) => c.name === fieldName)
      if (!column) {
        toBeAddedFields[fieldName] = field
        continue
      }

      if (!migrator.matchType(column.dataType, field.type)) {
        logger.warn(
          `Field ${fieldName} in table ${key} has a different type in the database. Expected ${field.type} but got ${column.dataType}.`,
        )
      }
    }
    if (Object.keys(toBeAddedFields).length > 0) {
      toBeAdded.push({
        table: key,
        fields: toBeAddedFields,
        order: value.order || Infinity,
      })
    }
  }

  async function runMigrations(): Promise<void> {
    for (const table of toBeCreated) {
      const idColumn = buildIdColumnDef(useNumberId, migrator)
      const fields: Record<string, ColumnDefinition> = {}
      for (const [fieldName, field] of Object.entries(table.fields)) {
        fields[fieldName] = buildColumnDef(field, fieldName, migrator, useNumberId)
      }
      await migrator.createTable(table.table, idColumn, fields)
    }
    for (const table of toBeAdded) {
      for (const [fieldName, field] of Object.entries(table.fields)) {
        await migrator.addColumn(
          table.table,
          fieldName,
          buildColumnDef(field, fieldName, migrator, useNumberId),
        )
      }
    }
    await migrator.dispose?.()
  }

  async function compileMigrations(): Promise<string> {
    const statements: string[] = []
    for (const table of toBeCreated) {
      if (!migrator.compileCreateTable) {
        throw new Error(
          `[unadapter] migrator does not implement compileCreateTable; cannot compile migrations.`,
        )
      }
      const idColumn = buildIdColumnDef(useNumberId, migrator)
      const fields: Record<string, ColumnDefinition> = {}
      for (const [fieldName, field] of Object.entries(table.fields)) {
        fields[fieldName] = buildColumnDef(field, fieldName, migrator, useNumberId)
      }
      statements.push(migrator.compileCreateTable(table.table, idColumn, fields))
    }
    for (const table of toBeAdded) {
      if (!migrator.compileAddColumn) {
        throw new Error(
          `[unadapter] migrator does not implement compileAddColumn; cannot compile migrations.`,
        )
      }
      for (const [fieldName, field] of Object.entries(table.fields)) {
        statements.push(
          migrator.compileAddColumn(
            table.table,
            fieldName,
            buildColumnDef(field, fieldName, migrator, useNumberId),
          ),
        )
      }
    }
    await migrator.dispose?.()
    return `${statements.join(";\n\n")};`
  }

  return { toBeCreated, toBeAdded, runMigrations, compileMigrations }
}

async function resolveMigrator<T extends Record<string, any>>(
  config: AdapterOptions<T>,
  getTables: (options: AdapterOptions<T>) => TablesSchema,
  logger: ReturnType<typeof createLogger>,
): Promise<AdapterMigrator> {
  const db = config.database

  // Path 1: caller passed an AdapterInstance — let the adapter build its own migrator.
  if (typeof db === "function") {
    const instance = (db as AdapterInstance<T>)(getTables as any, config)
    if (instance.createMigrator) {
      return await instance.createMigrator()
    }
    logger.error(
      `[unadapter] adapter "${instance.id}" does not implement createMigrator. ` +
        `Use that adapter's native schema tooling, or pass a Kysely-compatible database to runMigrations().`,
    )
    process.exit(1)
  }

  // Path 2: backwards-compatible Kysely autodetection (raw pool / dialect / { db, type } shapes).
  // Imported lazily to keep Kysely out of the engine's hard dependency surface.
  const { createKyselyMigrator } = await import("../adapters/kysely/migrator.ts")
  const migrator = await createKyselyMigrator(config)
  if (!migrator) {
    logger.error(
      "[unadapter] no migrator could be resolved. Pass an AdapterInstance whose adapter " +
        "implements createMigrator, or a Kysely-compatible database (Kysely instance, Dialect, " +
        "better-sqlite3 Database, mysql2 pool, or pg Pool).",
    )
    process.exit(1)
  }
  return migrator
}
