import type { Knex } from "knex"
import type {
  AdapterMigrator,
  ColumnDefinition,
  FieldAttribute,
  FieldType,
  MigratorOptions,
  TableInfo,
} from "../../types/index.ts"
import type { KnexDatabaseType } from "./types.ts"

const dialectTypeMap: Record<KnexDatabaseType, Record<string, string[]>> = {
  postgres: {
    string: ["character varying", "text"],
    number: ["int4", "integer", "bigint", "smallint", "numeric", "real", "double precision"],
    boolean: ["bool", "boolean"],
    date: ["timestamp", "timestamp with time zone", "date"],
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
  dialect: KnexDatabaseType,
): string {
  const useNumberId = options.useNumberId
  const idTypeMap: Record<KnexDatabaseType, string> = {
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
  dialect: KnexDatabaseType,
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

function applyColumn(
  builder: Knex.ColumnBuilder,
  column: ColumnDefinition,
  isPrimaryKey: boolean,
): void {
  if (column.notNull) builder.notNullable()
  if (column.references) {
    builder.references(column.references.field).inTable(column.references.table)
  }
  if (column.unique) builder.unique()
  if (isPrimaryKey) {
    // Knex emits PRIMARY KEY automatically for `.increments()` and respects
    // .primary() for non-incrementing columns.
    if (!column.autoIncrement) {
      builder.primary()
    }
  }
}

function defineColumn(
  table: Knex.CreateTableBuilder,
  name: string,
  column: ColumnDefinition,
  isPrimaryKey: boolean,
): void {
  if (isPrimaryKey && column.autoIncrement) {
    // increments() declares the column as integer + autoincrement + primary key.
    // We deliberately don't call specificType here — that would re-declare the column.
    const builder = table.increments(name)
    if (column.notNull) builder.notNullable()
    return
  }
  const builder = table.specificType(name, column.type)
  applyColumn(builder, column, isPrimaryKey)
}

export interface KnexMigratorOptions {
  db: Knex
  dialect: KnexDatabaseType
}

export function createKnexMigratorFromKnex(opts: KnexMigratorOptions): AdapterMigrator {
  const { db, dialect } = opts
  return {
    async introspect(): Promise<TableInfo[]> {
      // Knex doesn't ship a uniform introspection API across dialects,
      // so we issue a dialect-specific information_schema / pragma query.
      if (dialect === "sqlite") {
        const tables = await db.raw<{ name: string }[]>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        const rows = Array.isArray(tables) ? tables : []
        const result: TableInfo[] = []
        for (const t of rows) {
          const cols = await db.raw<{ name: string; type: string }[]>(
            `PRAGMA table_info(${t.name})`,
          )
          const colRows = Array.isArray(cols) ? cols : []
          result.push({
            name: t.name,
            columns: colRows.map((c) => ({ name: c.name, dataType: c.type })),
          })
        }
        return result
      }
      // mysql / postgres / mssql all expose information_schema
      const rows = await db
        .select<{ table_name: string; column_name: string; data_type: string }[]>(
          db.ref("table_name"),
          db.ref("column_name"),
          db.ref("data_type"),
        )
        .from("information_schema.columns")
        .where(
          dialect === "postgres"
            ? "table_catalog"
            : dialect === "mssql"
              ? "table_catalog"
              : "table_schema",
          db.client.database(),
        )
      const grouped = new Map<string, { name: string; dataType: string }[]>()
      for (const r of rows as any[]) {
        // information_schema column casing varies (postgres lower, mssql upper, mysql lower)
        const tableName = (r.table_name ?? r.TABLE_NAME) as string
        const columnName = (r.column_name ?? r.COLUMN_NAME) as string
        const dataType = (r.data_type ?? r.DATA_TYPE) as string
        if (!grouped.has(tableName)) grouped.set(tableName, [])
        grouped.get(tableName)!.push({ name: columnName, dataType })
      }
      return [...grouped.entries()].map(([name, columns]) => ({ name, columns }))
    },

    async createTable(table, idColumn, fields): Promise<void> {
      await db.schema.createTable(table, (t) => {
        defineColumn(t, "id", idColumn, true)
        for (const [fieldName, column] of Object.entries(fields)) {
          defineColumn(t, fieldName, column, false)
        }
      })
    },

    async addColumn(table, name, column): Promise<void> {
      await db.schema.alterTable(table, (t) => {
        defineColumn(t, name, column, false)
      })
    },

    resolveType(field, fieldName, options): string {
      return resolveType(field, fieldName, options, dialect)
    },

    matchType(columnDataType, fieldType): boolean {
      return matchType(columnDataType, fieldType, dialect)
    },

    compileCreateTable(table, idColumn, fields): string {
      let sql = ""
      const builder = db.schema.createTable(table, (t) => {
        defineColumn(t, "id", idColumn, true)
        for (const [fieldName, column] of Object.entries(fields)) {
          defineColumn(t, fieldName, column, false)
        }
      })
      sql = builder.toString()
      return sql
    },

    compileAddColumn(table, name, column): string {
      const builder = db.schema.alterTable(table, (t) => {
        defineColumn(t, name, column, false)
      })
      return builder.toString()
    },
  }
}
