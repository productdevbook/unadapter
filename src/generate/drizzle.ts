import type { AdapterOptions, FieldAttribute, FieldType, TablesSchema } from "../types/index.ts"

export type DrizzleDialect = "postgres" | "mysql" | "sqlite"

export interface DrizzleGenerateOptions {
  format: "drizzle"
  dialect: DrizzleDialect
}

type IdStrategy = "string" | "number" | "uuid" | "serial"

interface NormalizedTable {
  aliases: string[]
  modelName: string
  fields: Record<string, FieldAttribute>
  order: number
  variableName: string
}

interface NormalizedSchema {
  tables: NormalizedTable[]
  byAlias: Map<string, NormalizedTable>
  byModelName: Map<string, NormalizedTable>
}

interface RenderContext {
  dialect: DrizzleDialect
  imports: Set<string>
  schema: NormalizedSchema
  idStrategy: IdStrategy
}

const DIALECT_CONFIG: Record<DrizzleDialect, { table: string; importPath: string }> = {
  postgres: { table: "pgTable", importPath: "drizzle-orm/pg-core" },
  mysql: { table: "mysqlTable", importPath: "drizzle-orm/mysql-core" },
  sqlite: { table: "sqliteTable", importPath: "drizzle-orm/sqlite-core" },
}

const RESERVED_IDENTIFIERS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
])

export function generateDrizzle<T extends Record<string, any>>(
  getTables: (options: AdapterOptions<T>) => TablesSchema,
  options: AdapterOptions<T>,
  generateOptions: DrizzleGenerateOptions,
): string {
  const schema = normalizeSchema(getTables(options))
  const idStrategy = resolveIdStrategy(options)

  if (idStrategy === "uuid" && generateOptions.dialect !== "postgres") {
    throw new Error(
      `[unadapter] Drizzle UUID id generation is currently supported only for the postgres dialect.`,
    )
  }
  if (idStrategy === "serial" && generateOptions.dialect !== "postgres") {
    throw new Error(
      `[unadapter] Drizzle serial id generation is currently supported only for the postgres dialect.`,
    )
  }

  const context: RenderContext = {
    dialect: generateOptions.dialect,
    imports: new Set([DIALECT_CONFIG[generateOptions.dialect].table]),
    schema,
    idStrategy,
  }

  const tables = schema.tables.map((table) => renderTable(table, context)).join("\n\n")
  const imports = [...context.imports].sort().join(", ")
  const { importPath } = DIALECT_CONFIG[generateOptions.dialect]

  return `import { ${imports} } from "${importPath}"

${tables}
`
}

function normalizeSchema(tables: TablesSchema): NormalizedSchema {
  const byModelName = new Map<string, NormalizedTable>()
  const byAlias = new Map<string, NormalizedTable>()

  for (const [alias, table] of Object.entries(tables)) {
    if (!table.modelName) {
      throw new Error(`[unadapter] Drizzle generation requires a modelName for table "${alias}".`)
    }

    let normalized = byModelName.get(table.modelName)
    if (!normalized) {
      normalized = {
        aliases: [],
        modelName: table.modelName,
        fields: {},
        order: table.order ?? Number.POSITIVE_INFINITY,
        variableName: "",
      }
      byModelName.set(table.modelName, normalized)
    }

    normalized.aliases.push(alias)
    normalized.fields = { ...normalized.fields, ...table.fields }
    normalized.order = Math.min(normalized.order, table.order ?? Number.POSITIVE_INFINITY)
    byAlias.set(alias, normalized)
  }

  const usedVariableNames = new Set<string>()
  const normalizedTables = [...byModelName.values()]
    .sort((a, b) => a.order - b.order || a.modelName.localeCompare(b.modelName))
    .map((table) => {
      const baseName = toIdentifier(table.aliases[0] || table.modelName)
      let variableName = baseName
      let suffix = 2
      while (usedVariableNames.has(variableName)) {
        variableName = `${baseName}${suffix++}`
      }
      usedVariableNames.add(variableName)
      table.variableName = variableName
      return table
    })

  return { tables: normalizedTables, byAlias, byModelName }
}

function resolveIdStrategy<T extends Record<string, any>>(options: AdapterOptions<T>): IdStrategy {
  const database = options.advanced?.database
  if (database?.useNumberId === true) return "number"
  if (database?.generateId === "uuid") return "uuid"
  if (database?.generateId === "serial") return "serial"
  return "string"
}

function renderTable(table: NormalizedTable, context: RenderContext): string {
  const columns = [
    `    id: ${renderIdColumn(context)}`,
    ...Object.entries(table.fields)
      .filter(([fieldName]) => fieldName !== "id")
      .map(
        ([fieldName, field]) =>
          `    ${renderPropertyName(fieldName)}: ${renderColumn(fieldName, field, context)}`,
      ),
  ]

  const indexedFields = Object.entries(table.fields).filter(([, field]) => field.index)
  if (indexedFields.length > 0) {
    context.imports.add("index")
  }

  const indexCallback =
    indexedFields.length > 0
      ? `, (table) => [\n${indexedFields
          .map(
            ([fieldName, field]) =>
              `    index(${JSON.stringify(`${table.modelName}_${field.fieldName || fieldName}_idx`)}).on(table${renderPropertyAccess(fieldName)}),`,
          )
          .join("\n")}\n  ]`
      : ""

  return `export const ${table.variableName} = ${DIALECT_CONFIG[context.dialect].table}(${JSON.stringify(table.modelName)}, {
${columns.join(",\n")}
  }${indexCallback})`
}

function renderIdColumn(context: RenderContext): string {
  const builder = renderIdBuilder(context, JSON.stringify("id"), false)

  if (
    context.dialect === "sqlite" &&
    (context.idStrategy === "number" || context.idStrategy === "serial")
  ) {
    return `${builder}.primaryKey({ autoIncrement: true })`
  }

  return `${builder}.primaryKey()`
}

function renderColumn(fieldName: string, field: FieldAttribute, context: RenderContext): string {
  let builder = renderFieldBuilder(fieldName, field, context)

  if (field.required !== false) builder += ".notNull()"
  if (field.unique) builder += ".unique()"
  if (field.type === "date" && typeof field.defaultValue === "function") {
    builder += ".defaultNow()"
  }

  if (field.references) {
    const target = resolveReferencedTable(field.references.model, context.schema)
    const targetField = resolveReferencedField(target, field.references.field)
    const onDelete = field.references.onDelete
      ? `, { onDelete: ${JSON.stringify(field.references.onDelete)} }`
      : ""
    builder += `.references(() => ${target.variableName}${renderPropertyAccess(targetField)}${onDelete})`
  }

  return builder
}

function renderFieldBuilder(
  fieldName: string,
  field: FieldAttribute,
  context: RenderContext,
): string {
  const databaseName = JSON.stringify(field.fieldName || fieldName)

  if (field.references?.field === "id") {
    return renderIdBuilder(context, databaseName, true)
  }

  if (field.type === "json" || field.type === "string[]" || field.type === "number[]") {
    if (context.dialect === "postgres") {
      context.imports.add("jsonb")
      return `jsonb(${databaseName})`
    }
    if (context.dialect === "mysql") {
      context.imports.add("json")
      return `json(${databaseName})`
    }
    context.imports.add("text")
    return `text(${databaseName}, { mode: "json" })`
  }

  if (Array.isArray(field.type)) {
    context.imports.add("text")
    return `text(${databaseName})`
  }

  switch (field.type as FieldType) {
    case "string":
      if (
        context.dialect === "mysql" &&
        (field.unique || field.index || field.sortable || field.references)
      ) {
        context.imports.add("varchar")
        return `varchar(${databaseName}, { length: ${field.references ? 36 : 255} })`
      }
      context.imports.add("text")
      return `text(${databaseName})`
    case "number":
      if (field.bigint && context.dialect !== "sqlite") {
        context.imports.add("bigint")
        return `bigint(${databaseName}, { mode: "number" })`
      }
      context.imports.add(context.dialect === "mysql" ? "int" : "integer")
      return `${context.dialect === "mysql" ? "int" : "integer"}(${databaseName})`
    case "boolean":
      if (context.dialect === "sqlite") {
        context.imports.add("integer")
        return `integer(${databaseName}, { mode: "boolean" })`
      }
      context.imports.add("boolean")
      return `boolean(${databaseName})`
    case "date":
      if (context.dialect === "postgres") {
        context.imports.add("timestamp")
        return `timestamp(${databaseName})`
      }
      if (context.dialect === "mysql") {
        context.imports.add("datetime")
        return `datetime(${databaseName})`
      }
      context.imports.add("integer")
      return `integer(${databaseName}, { mode: "timestamp" })`
    default:
      context.imports.add("text")
      return `text(${databaseName})`
  }
}

function renderIdBuilder(context: RenderContext, databaseName: string, reference: boolean): string {
  if (context.idStrategy === "uuid") {
    context.imports.add("uuid")
    return reference ? `uuid(${databaseName})` : `uuid(${databaseName}).defaultRandom()`
  }

  if (context.idStrategy === "number" || context.idStrategy === "serial") {
    if (context.dialect === "postgres") {
      if (reference) {
        context.imports.add("integer")
        return `integer(${databaseName})`
      }
      context.imports.add("serial")
      return `serial(${databaseName})`
    }
    if (context.dialect === "mysql") {
      context.imports.add("int")
      return reference ? `int(${databaseName})` : `int(${databaseName}).autoincrement()`
    }
    context.imports.add("integer")
    return `integer(${databaseName})`
  }

  if (context.dialect === "mysql") {
    context.imports.add("varchar")
    return `varchar(${databaseName}, { length: 36 })`
  }

  context.imports.add("text")
  return `text(${databaseName})`
}

function resolveReferencedTable(modelName: string, schema: NormalizedSchema): NormalizedTable {
  const target = schema.byAlias.get(modelName) || schema.byModelName.get(modelName)
  if (!target) {
    throw new Error(
      `[unadapter] Drizzle generation could not resolve referenced model "${modelName}".`,
    )
  }
  return target
}

function resolveReferencedField(table: NormalizedTable, fieldName: string): string {
  if (fieldName === "id") return "id"
  if (table.fields[fieldName]) return fieldName

  const matchingField = Object.entries(table.fields).find(
    ([key, field]) => (field.fieldName || key) === fieldName,
  )
  if (matchingField) return matchingField[0]

  throw new Error(
    `[unadapter] Drizzle generation could not resolve referenced field "${fieldName}" on model "${table.modelName}".`,
  )
}

function toIdentifier(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_$]/g, "_") || "table"
  const prefixed = /^[A-Za-z_$]/.test(sanitized) ? sanitized : `_${sanitized}`
  return RESERVED_IDENTIFIERS.has(prefixed) ? `_${prefixed}` : prefixed
}

function renderPropertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value)
}

function renderPropertyAccess(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? `.${value}` : `[${JSON.stringify(value)}]`
}
