import type { FieldAttribute, FieldType } from "./db.ts"

export interface ColumnInfo {
  name: string
  dataType: string
}

export interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

export interface ColumnDefinition {
  type: string
  notNull: boolean
  primaryKey?: boolean
  autoIncrement?: boolean
  unique?: boolean
  references?: { table: string; field: string }
}

export interface MigratorOptions {
  useNumberId: boolean
}

/**
 * Adapter-supplied migrator. Each adapter that supports schema migrations
 * implements this to introspect and emit DDL using its own native API.
 *
 * Adapters that don't support migrations (mongodb, memory, prisma, drizzle)
 * may simply not provide one; the engine reports a clear error in that case.
 */
export interface AdapterMigrator {
  introspect: () => Promise<TableInfo[]>
  createTable: (
    table: string,
    idColumn: ColumnDefinition,
    fields: Record<string, ColumnDefinition>,
  ) => Promise<void>
  addColumn: (table: string, name: string, column: ColumnDefinition) => Promise<void>
  resolveType: (field: FieldAttribute, fieldName: string, options: MigratorOptions) => string
  matchType: (columnDataType: string, fieldType: FieldType) => boolean
  compileCreateTable?: (
    table: string,
    idColumn: ColumnDefinition,
    fields: Record<string, ColumnDefinition>,
  ) => string
  compileAddColumn?: (table: string, name: string, column: ColumnDefinition) => string
  dispose?: () => Promise<void>
}
