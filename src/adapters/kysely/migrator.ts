import type { AlterTableColumnAlteringBuilder, CreateTableBuilder, Kysely } from "kysely"
import { sql } from "kysely"
import type {
  AdapterMigrator,
  AdapterOptions,
  ColumnDefinition,
  FieldAttribute,
  FieldType,
  MigratorOptions,
  TableInfo,
} from "../../types/index.ts"
import type { KyselyDatabaseType } from "./types.ts"
import { createKyselyAdapter } from "./dialect.ts"

const dialectTypeMap: Record<KyselyDatabaseType, Record<string, string[]>> = {
  postgres: {
    string: ["character varying", "text"],
    number: ["int4", "integer", "bigint", "smallint", "numeric", "real", "double precision"],
    boolean: ["bool", "boolean"],
    date: ["timestamp", "date"],
  },
  mysql: {
    string: ["varchar", "text"],
    number: ["integer", "int", "bigint", "smallint", "decimal", "float", "double"],
    boolean: ["boolean", "tinyint"],
    date: ["timestamp", "datetime", "date"],
  },
  sqlite: {
    string: ["TEXT"],
    number: ["INTEGER", "REAL"],
    boolean: ["INTEGER", "BOOLEAN"],
    date: ["DATE", "INTEGER"],
  },
  mssql: {
    string: ["text", "varchar"],
    number: ["int", "bigint", "smallint", "decimal", "float", "double"],
    boolean: ["bit", "smallint"],
    date: ["datetime", "date"],
  },
}

function resolveType(
  field: FieldAttribute,
  fieldName: string,
  options: MigratorOptions,
  dialect: KyselyDatabaseType,
): string {
  const useNumberId = options.useNumberId
  const idTypeMap: Record<KyselyDatabaseType, string> = {
    postgres: useNumberId ? "serial" : "text",
    mysql: useNumberId ? "integer" : "varchar(36)",
    mssql: useNumberId ? "integer" : "varchar(36)",
    sqlite: useNumberId ? "integer" : "text",
  }

  if (fieldName === "id" || field.references?.field === "id") {
    return idTypeMap[dialect]
  }

  const type = field.type
  if (dialect === "sqlite" && (type === "string[]" || type === "number[]")) {
    return "text"
  }
  if (type === "string[]" || type === "number[]") {
    return "jsonb"
  }
  if (Array.isArray(type)) {
    return "text"
  }

  const stringTypeMap: Record<KyselyDatabaseType, string> = {
    sqlite: "text",
    postgres: "text",
    mysql: field.unique ? "varchar(255)" : field.references ? "varchar(36)" : "text",
    mssql:
      field.unique || field.sortable ? "varchar(255)" : field.references ? "varchar(36)" : "text",
  }
  const booleanTypeMap: Record<KyselyDatabaseType, string> = {
    sqlite: "integer",
    postgres: "boolean",
    mysql: "boolean",
    mssql: "smallint",
  }
  const numberTypeMap: Record<KyselyDatabaseType, string> = {
    sqlite: field.bigint ? "bigint" : "integer",
    postgres: field.bigint ? "bigint" : "integer",
    mysql: field.bigint ? "bigint" : "integer",
    mssql: field.bigint ? "bigint" : "integer",
  }
  const dateTypeMap: Record<KyselyDatabaseType, string> = {
    sqlite: "date",
    postgres: "timestamp",
    mysql: "datetime",
    mssql: "datetime",
  }

  switch (type) {
    case "string":
      return stringTypeMap[dialect]
    case "boolean":
      return booleanTypeMap[dialect]
    case "number":
      return numberTypeMap[dialect]
    case "date":
      return dateTypeMap[dialect]
  }

  return stringTypeMap[dialect]
}

function matchType(
  columnDataType: string,
  fieldType: FieldType,
  dialect: KyselyDatabaseType,
): boolean {
  if (fieldType === "string[]" || fieldType === "number[]") {
    return columnDataType.toLowerCase().includes("json")
  }
  const types = dialectTypeMap[dialect]
  const acceptable = (Array.isArray(fieldType) ? types.string : types[fieldType] || []).map((t) =>
    t.toLowerCase(),
  )
  return acceptable.includes(columnDataType.toLowerCase())
}

function applyColumn<
  T extends {
    notNull: () => any
    references: (s: string) => any
    unique: () => any
    primaryKey: () => any
    autoIncrement: () => any
  },
>(col: T, column: ColumnDefinition, isPrimaryKey: boolean, dialect: KyselyDatabaseType): T {
  let result: any = col
  if (column.notNull) result = result.notNull()
  if (column.references) {
    result = result.references(`${column.references.table}.${column.references.field}`)
  }
  if (column.unique) result = result.unique()
  if (isPrimaryKey) {
    if (column.autoIncrement && dialect !== "postgres") {
      result = result.autoIncrement()
    }
    result = result.primaryKey()
  }
  return result
}

function buildCreateTableBuilder(
  db: Kysely<any>,
  table: string,
  idColumn: ColumnDefinition,
  fields: Record<string, ColumnDefinition>,
  dialect: KyselyDatabaseType,
): CreateTableBuilder<string, string> {
  let builder = db.schema
    .createTable(table)
    .addColumn("id", sql.raw(idColumn.type) as any, (col) =>
      applyColumn(col, idColumn, true, dialect),
    )
  for (const [fieldName, column] of Object.entries(fields)) {
    builder = builder.addColumn(fieldName, sql.raw(column.type) as any, (col) =>
      applyColumn(col, column, false, dialect),
    )
  }
  return builder
}

function buildAddColumnBuilder(
  db: Kysely<any>,
  table: string,
  name: string,
  column: ColumnDefinition,
  dialect: KyselyDatabaseType,
): AlterTableColumnAlteringBuilder {
  return db.schema
    .alterTable(table)
    .addColumn(name, sql.raw(column.type) as any, (col) => applyColumn(col, column, false, dialect))
}

export interface KyselyMigratorOptions {
  db: Kysely<any>
  dialect: KyselyDatabaseType
  ownsDb?: boolean
}

export function createKyselyMigratorFromKysely(opts: KyselyMigratorOptions): AdapterMigrator {
  const { db, dialect, ownsDb } = opts
  return {
    async introspect(): Promise<TableInfo[]> {
      const tables = await db.introspection.getTables()
      return tables.map((t) => ({
        name: t.name,
        columns: t.columns.map((c) => ({ name: c.name, dataType: c.dataType })),
      }))
    },
    async createTable(table, idColumn, fields): Promise<void> {
      await buildCreateTableBuilder(db, table, idColumn, fields, dialect).execute()
    },
    async addColumn(table, name, column): Promise<void> {
      await buildAddColumnBuilder(db, table, name, column, dialect).execute()
    },
    resolveType(field, fieldName, options): string {
      return resolveType(field, fieldName, options, dialect)
    },
    matchType(columnDataType, fieldType): boolean {
      return matchType(columnDataType, fieldType, dialect)
    },
    compileCreateTable(table, idColumn, fields): string {
      return buildCreateTableBuilder(db, table, idColumn, fields, dialect).compile().sql
    },
    compileAddColumn(table, name, column): string {
      return buildAddColumnBuilder(db, table, name, column, dialect).compile().sql
    },
    async dispose(): Promise<void> {
      if (ownsDb) await db.destroy()
    },
  }
}

/**
 * Best-effort autodetection: builds a Kysely-backed migrator from any of
 * the database shapes `createKyselyAdapter` knows about (raw pool, dialect,
 * { db, type }, etc.). Returns `null` if no shape matches — the caller
 * should then surface a clear error.
 */
export async function createKyselyMigrator<T extends Record<string, any>>(
  config: AdapterOptions<T>,
): Promise<AdapterMigrator | null> {
  const { kysely, databaseType } = await createKyselyAdapter(config)
  if (!kysely) return null
  const dialect: KyselyDatabaseType = databaseType ?? "sqlite"
  // We only own the Kysely instance if we constructed it (i.e. the caller
  // didn't pass a pre-built `{ db, type }`). Detection: if the original
  // config.database had a `db` property, the caller owns it.
  const ownsDb =
    !config.database ||
    typeof config.database !== "object" ||
    !("db" in (config.database as object))
  return createKyselyMigratorFromKysely({ db: kysely, dialect, ownsDb })
}
