import type { AlterTableColumnAlteringBuilder, CreateTableBuilder, Kysely } from "kysely"
import type {
  AdapterMigrator,
  AdapterOptions,
  ColumnDefinition,
  FieldAttribute,
  FieldType,
  IndexDefinition,
  MigratorOptions,
  TableInfo,
} from "../../types/index.ts"
import type { KyselyDatabaseType } from "./types.ts"
import { sql } from "kysely"
import { createKyselyAdapter } from "./dialect.ts"

const dialectTypeMap: Record<KyselyDatabaseType, Record<string, string[]>> = {
  postgres: {
    string: ["character varying", "text"],
    number: ["int4", "integer", "bigint", "smallint", "numeric", "real", "double precision"],
    boolean: ["bool", "boolean"],
    date: ["timestamp", "timestamp with time zone", "date"],
    json: ["json", "jsonb"],
  },
  mysql: {
    string: ["varchar", "text"],
    number: ["integer", "int", "bigint", "smallint", "decimal", "float", "double"],
    boolean: ["boolean", "tinyint"],
    date: ["timestamp", "datetime", "date"],
    json: ["json"],
  },
  sqlite: {
    string: ["TEXT"],
    number: ["INTEGER", "REAL"],
    boolean: ["INTEGER", "BOOLEAN"],
    date: ["DATE", "INTEGER"],
    json: ["TEXT"],
  },
  mssql: {
    string: ["text", "varchar"],
    number: ["int", "bigint", "smallint", "decimal", "float", "double"],
    boolean: ["bit", "smallint"],
    date: ["datetime", "date"],
    json: ["varchar", "text"],
  },
}

function resolveType(
  field: FieldAttribute,
  fieldName: string,
  options: MigratorOptions,
  dialect: KyselyDatabaseType,
): string {
  // id / FK to id: type depends on the id generation strategy.
  const isIdLike = fieldName === "id" || field.references?.field === "id"
  if (isIdLike) {
    switch (options.idStrategy) {
      case "number":
        return dialect === "postgres" ? "serial" : "integer"
      case "serial":
        return dialect === "postgres" ? "integer" : "integer"
      case "uuid":
        return dialect === "postgres" ? "uuid" : "varchar(36)"
      case "string":
      default:
        return dialect === "sqlite" || dialect === "postgres" ? "text" : "varchar(36)"
    }
  }

  const type = field.type
  if (type === "json") {
    if (dialect === "postgres") return "jsonb"
    if (dialect === "mysql") return "json"
    if (dialect === "mssql") return "varchar(8000)"
    return "text" // sqlite
  }
  if (dialect === "sqlite" && (type === "string[]" || type === "number[]")) {
    return "text"
  }
  if (type === "string[]" || type === "number[]") {
    return "jsonb"
  }
  if (Array.isArray(type)) {
    return "text"
  }

  switch (type) {
    case "string":
      if (dialect === "mysql") {
        return field.unique ? "varchar(255)" : field.references ? "varchar(36)" : "text"
      }
      if (dialect === "mssql") {
        return field.unique || field.sortable
          ? "varchar(255)"
          : field.references
            ? "varchar(36)"
            : "text"
      }
      return "text"
    case "boolean":
      if (dialect === "sqlite") return "integer"
      if (dialect === "mssql") return "smallint"
      return "boolean"
    case "number":
      return field.bigint ? "bigint" : "integer"
    case "date":
      if (dialect === "sqlite") return "date"
      if (dialect === "postgres") return "timestamp"
      return "datetime"
  }
  return "text"
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
  const lookup = (Array.isArray(fieldType) ? types.string : types[fieldType]) || []
  const acceptable = lookup.map((t) => t.toLowerCase())
  return acceptable.includes(columnDataType.toLowerCase())
}

function applyColumn<
  T extends {
    notNull: () => any
    defaultTo: (value: any) => any
    references: (s: string) => any
    unique: () => any
    primaryKey: () => any
    autoIncrement: () => any
    generatedByDefaultAsIdentity?: () => any
  },
>(
  col: T,
  column: ColumnDefinition,
  isPrimaryKey: boolean,
  dialect: KyselyDatabaseType,
  idStrategy: MigratorOptions["idStrategy"],
): T {
  let result: any = col
  if (column.notNull) result = result.notNull()
  if (column.references) {
    result = result.references(`${column.references.table}.${column.references.field}`)
  }
  if (column.unique) result = result.unique()
  if (column.defaultExpr) {
    result = result.defaultTo(sql.raw(column.defaultExpr))
  }
  if (isPrimaryKey) {
    if (idStrategy === "serial" && dialect === "postgres") {
      // Use IDENTITY rather than autoIncrement on Postgres.
      if (typeof result.generatedByDefaultAsIdentity === "function") {
        result = result.generatedByDefaultAsIdentity()
      }
    } else if (column.autoIncrement && dialect !== "postgres") {
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
  idStrategy: MigratorOptions["idStrategy"],
): CreateTableBuilder<string, string> {
  let builder = db.schema
    .createTable(table)
    .addColumn("id", sql.raw(idColumn.type) as any, (col) =>
      applyColumn(col, idColumn, true, dialect, idStrategy),
    )
  for (const [fieldName, column] of Object.entries(fields)) {
    builder = builder.addColumn(fieldName, sql.raw(column.type) as any, (col) =>
      applyColumn(col, column, false, dialect, idStrategy),
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
  idStrategy: MigratorOptions["idStrategy"],
): AlterTableColumnAlteringBuilder {
  return db.schema
    .alterTable(table)
    .addColumn(name, sql.raw(column.type) as any, (col) =>
      applyColumn(col, column, false, dialect, idStrategy),
    )
}

function indexName(index: IndexDefinition): string {
  return `${index.table}_${index.field}_idx`
}

async function getPostgresSchema(db: Kysely<any>): Promise<string | null> {
  try {
    const result = await sql<{ search_path: string }>`SHOW search_path`.execute(db)
    const row = result.rows[0]
    if (!row) return null
    // search_path is a comma-separated list — pick the first non-variable entry.
    const candidates = row.search_path
      .split(",")
      .map((p) => p.trim().replace(/^"|"$/g, ""))
      .filter((p) => p && !p.startsWith("$"))
    return candidates[0] ?? null
  } catch {
    return null
  }
}

export interface KyselyMigratorOptions {
  db: Kysely<any>
  dialect: KyselyDatabaseType
}

export function createKyselyMigratorFromKysely(opts: KyselyMigratorOptions): AdapterMigrator {
  const { db, dialect } = opts

  return {
    async introspect(): Promise<TableInfo[]> {
      const tables = await db.introspection.getTables()
      // Postgres: filter to the active search_path schema so multi-schema
      // databases don't conflate tables from other schemas.
      let filterSchema: string | null = null
      if (dialect === "postgres") {
        filterSchema = await getPostgresSchema(db)
      }
      // If Kysely's introspection populates `schema` on every row (newer
      // versions do), use it to filter to the active search_path. If
      // *no* row carries a schema field, the dialect doesn't expose one
      // and we keep the legacy "trust everything" behavior.
      const exposesSchemaField =
        filterSchema !== null &&
        tables.some((t) => typeof (t as { schema?: string }).schema === "string")
      return tables
        .filter((t) => {
          if (!filterSchema || !exposesSchemaField) return true
          return (t as unknown as { schema?: string }).schema === filterSchema
        })
        .map((t) => ({
          name: t.name,
          columns: t.columns.map((c) => ({ name: c.name, dataType: c.dataType })),
        }))
    },
    async createTable(table, idColumn, fields, options): Promise<void> {
      await buildCreateTableBuilder(
        db,
        table,
        idColumn,
        fields,
        dialect,
        options.idStrategy,
      ).execute()
    },
    async addColumn(table, name, column, options): Promise<void> {
      await buildAddColumnBuilder(db, table, name, column, dialect, options.idStrategy).execute()
    },
    async createIndex(index): Promise<void> {
      let builder = db.schema.createIndex(indexName(index)).on(index.table).column(index.field)
      if (index.unique) builder = builder.unique()
      await builder.execute()
    },
    resolveType(field, fieldName, options): string {
      return resolveType(field, fieldName, options, dialect)
    },
    matchType(columnDataType, fieldType): boolean {
      return matchType(columnDataType, fieldType, dialect)
    },
    compileCreateTable(table, idColumn, fields, options): string {
      return buildCreateTableBuilder(
        db,
        table,
        idColumn,
        fields,
        dialect,
        options.idStrategy,
      ).compile().sql
    },
    compileAddColumn(table, name, column, options): string {
      return buildAddColumnBuilder(db, table, name, column, dialect, options.idStrategy).compile()
        .sql
    },
    compileCreateIndex(index): string {
      let builder = db.schema.createIndex(indexName(index)).on(index.table).column(index.field)
      if (index.unique) builder = builder.unique()
      return builder.compile().sql
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
  return createKyselyMigratorFromKysely({ db: kysely, dialect })
}
