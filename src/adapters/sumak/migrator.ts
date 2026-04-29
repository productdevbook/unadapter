import type { Sumak } from "sumak"
import type {
  AdapterMigrator,
  ColumnDefinition,
  FieldAttribute,
  FieldType,
  IndexDefinition,
  MigratorOptions,
  TableInfo,
} from "../../types/index.ts"
import type { SumakDatabaseType } from "./types.ts"
import { introspect, unsafeRawExpr } from "sumak"

const dialectTypeMap: Record<SumakDatabaseType, Record<string, string[]>> = {
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
  dialect: SumakDatabaseType,
): string {
  const isIdLike = fieldName === "id" || field.references?.field === "id"
  if (isIdLike) {
    switch (options.idStrategy) {
      case "number":
        return dialect === "postgres" ? "serial" : "integer"
      case "serial":
        return "integer"
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
    return "text"
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
  dialect: SumakDatabaseType,
): boolean {
  if (fieldType === "string[]" || fieldType === "number[]") {
    return columnDataType.toLowerCase().includes("json")
  }
  const types = dialectTypeMap[dialect]
  const lookup = (Array.isArray(fieldType) ? types.string : types[fieldType]) || []
  const acceptable = lookup.map((t) => t.toLowerCase())
  return acceptable.includes(columnDataType.toLowerCase())
}

function applyColumnDef(builder: any, column: ColumnDefinition, isPrimaryKey: boolean): any {
  let b = builder
  if (column.notNull) b = b.notNull()
  if (column.unique) b = b.unique()
  if (column.references) {
    b = b.references(column.references.table, column.references.field)
  }
  if (column.defaultExpr) {
    b = b.defaultTo(unsafeRawExpr(column.defaultExpr))
  }
  if (isPrimaryKey) {
    if (column.autoIncrement) b = b.autoIncrement()
    b = b.primaryKey()
  }
  return b
}

function indexName(index: IndexDefinition): string {
  return `${index.table}_${index.field}_idx`
}

export interface SumakMigratorOptions {
  db: Sumak<any>
  dialect: SumakDatabaseType
}

/**
 * Sumak-driven migrator. Schema introspection comes from sumak's
 * built-in `introspect()` helper (works against any dialect's driver),
 * DDL is emitted via the `db.schema` builders + `executeCompiledNoRows`.
 */
export function createSumakMigratorFromSumak(opts: SumakMigratorOptions): AdapterMigrator {
  const { db, dialect } = opts
  const sumakDialectName: "pg" | "mysql" | "sqlite" | "mssql" =
    dialect === "postgres" ? "pg" : dialect

  return {
    async introspect(): Promise<TableInfo[]> {
      const driver = (db as any)._driver ?? (db as any).driver
      if (!driver) {
        // Without a driver attached we can't introspect — return empty
        // so the engine treats every schema entry as new (idempotent on
        // re-runs against an empty database).
        return []
      }
      const schema = await introspect(driver, sumakDialectName)
      return schema.tables.map((t) => ({
        name: t.name,
        columns: t.columns.map((c) => ({ name: c.name, dataType: c.dataType })),
      }))
    },

    async createTable(table, idColumn, fields, _options): Promise<void> {
      let b = (db as any).schema.createTable(table)
      b = b.addColumn("id", idColumn.type, (col: any) => applyColumnDef(col, idColumn, true))
      for (const [fieldName, column] of Object.entries(fields)) {
        b = b.addColumn(fieldName, column.type, (col: any) => applyColumnDef(col, column, false))
      }
      const node = b.build()
      const compiled = (db as any).compileDDL(node)
      await (db as any).executeCompiledNoRows(compiled)
    },

    async addColumn(table, name, column, _options): Promise<void> {
      const node = (db as any).schema
        .alterTable(table)
        .addColumn(name, column.type, (col: any) => applyColumnDef(col, column, false))
        .build()
      const compiled = (db as any).compileDDL(node)
      await (db as any).executeCompiledNoRows(compiled)
    },

    async createIndex(index): Promise<void> {
      let b = (db as any).schema.createIndex(indexName(index)).on(index.table).column(index.field)
      if (index.unique) b = b.unique()
      const node = b.build()
      const compiled = (db as any).compileDDL(node)
      await (db as any).executeCompiledNoRows(compiled)
    },

    resolveType(field, fieldName, options): string {
      return resolveType(field, fieldName, options, dialect)
    },

    matchType(columnDataType, fieldType): boolean {
      return matchType(columnDataType, fieldType, dialect)
    },

    compileCreateTable(table, idColumn, fields, _options): string {
      let b = (db as any).schema.createTable(table)
      b = b.addColumn("id", idColumn.type, (col: any) => applyColumnDef(col, idColumn, true))
      for (const [fieldName, column] of Object.entries(fields)) {
        b = b.addColumn(fieldName, column.type, (col: any) => applyColumnDef(col, column, false))
      }
      const node = b.build()
      return (db as any).compileDDL(node).sql
    },

    compileAddColumn(table, name, column, _options): string {
      const node = (db as any).schema
        .alterTable(table)
        .addColumn(name, column.type, (col: any) => applyColumnDef(col, column, false))
        .build()
      return (db as any).compileDDL(node).sql
    },

    compileCreateIndex(index): string {
      let b = (db as any).schema.createIndex(indexName(index)).on(index.table).column(index.field)
      if (index.unique) b = b.unique()
      return (db as any).compileDDL(b.build()).sql
    },
  }
}
