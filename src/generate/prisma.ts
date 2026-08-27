import type { AdapterOptions, FieldAttribute, FieldType, TablesSchema } from "../types/index.ts"

export type PrismaProvider =
  | "postgresql"
  | "postgres"
  | "mysql"
  | "sqlite"
  | "sqlserver"
  | "cockroachdb"
  | "mongodb"

export interface PrismaGenerateOptions {
  format: "prisma"
  /**
   * Target database provider for Prisma.
   */
  provider?: PrismaProvider
  /**
   * Alias for provider.
   */
  dialect?: PrismaProvider
  /**
   * Whether to include `generator client` and `datasource db` blocks at the top.
   *
   * @default false
   */
  includeDatasource?: boolean
}

type IdStrategy = "string" | "number" | "uuid" | "serial" | "cuid" | "nanoid"

interface NormalizedTable {
  aliases: string[]
  modelName: string
  pascalName: string
  fields: Record<string, FieldAttribute>
  order: number
}

interface NormalizedSchema {
  tables: NormalizedTable[]
  byAlias: Map<string, NormalizedTable>
  byModelName: Map<string, NormalizedTable>
  byPascalName: Map<string, NormalizedTable>
}

interface RelationInfo {
  sourceTable: NormalizedTable
  sourceField: string
  targetTable: NormalizedTable
  targetField: string
  relationFieldName: string
  backRelationFieldName: string
  relationName?: string
  isOneToOne: boolean
  onDelete?: string
  required: boolean
}

export function generatePrisma<T extends Record<string, any>>(
  getTables: (options: AdapterOptions<T>) => TablesSchema,
  options: AdapterOptions<T>,
  generateOptions: PrismaGenerateOptions,
): string {
  const schema = normalizeSchema(getTables(options))
  const idStrategy = resolveIdStrategy(options)
  const relations = collectRelations(schema)

  const models = schema.tables.map((table) => renderModel(table, schema, idStrategy, relations))

  let header = ""
  if (generateOptions.includeDatasource) {
    const rawProvider = generateOptions.provider || generateOptions.dialect || "postgresql"
    const provider = rawProvider === "postgres" ? "postgresql" : rawProvider
    header = `generator client {
  provider = "prisma-client"
}

datasource db {
  provider = "${provider}"
}

`
  }

  return `${header}${models.join("\n\n")}\n`
}

function normalizeSchema(tables: TablesSchema): NormalizedSchema {
  const byModelName = new Map<string, NormalizedTable>()
  const byAlias = new Map<string, NormalizedTable>()
  const byPascalName = new Map<string, NormalizedTable>()

  for (const [alias, table] of Object.entries(tables)) {
    if (!table.modelName) {
      throw new Error(`[unadapter] Prisma generation requires a modelName for table "${alias}".`)
    }

    let normalized = byModelName.get(table.modelName)
    if (!normalized) {
      normalized = {
        aliases: [],
        modelName: table.modelName,
        pascalName: "",
        fields: {},
        order: table.order ?? Number.POSITIVE_INFINITY,
      }
      byModelName.set(table.modelName, normalized)
    }

    normalized.aliases.push(alias)
    normalized.fields = { ...normalized.fields, ...table.fields }
    normalized.order = Math.min(normalized.order, table.order ?? Number.POSITIVE_INFINITY)
    byAlias.set(alias, normalized)
  }

  const usedPascalNames = new Set<string>()
  const normalizedTables = [...byModelName.values()]
    .sort((a, b) => a.order - b.order || a.modelName.localeCompare(b.modelName))
    .map((table) => {
      const baseName = toPascalCase(table.aliases[0] || table.modelName)
      let pascalName = baseName
      let suffix = 2
      while (usedPascalNames.has(pascalName)) {
        pascalName = `${baseName}${suffix++}`
      }
      usedPascalNames.add(pascalName)
      table.pascalName = pascalName
      byPascalName.set(pascalName, table)
      return table
    })

  return { tables: normalizedTables, byAlias, byModelName, byPascalName }
}

function resolveIdStrategy<T extends Record<string, any>>(options: AdapterOptions<T>): IdStrategy {
  const database = options.advanced?.database
  if (database?.useNumberId === true) return "number"
  if (database?.generateId === "uuid") return "uuid"
  if (database?.generateId === "serial") return "serial"
  if (database?.generateId === "cuid") return "cuid"
  if (database?.generateId === "nanoid") return "nanoid"
  return "string"
}

function collectRelations(schema: NormalizedSchema): RelationInfo[] {
  const relations: RelationInfo[] = []
  const pairCounts = new Map<string, number>()

  // First pass: identify all relations and count relations per (source, target) pair
  for (const table of schema.tables) {
    for (const [, field] of Object.entries(table.fields)) {
      if (!field.references) continue
      const targetTable = resolveReferencedTable(field.references.model, schema)
      const pairKey = `${table.pascalName}->${targetTable.pascalName}`
      pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1)
    }
  }

  // Second pass: build relation definitions with names if multiple
  const usedBackRelations = new Map<string, Set<string>>()

  for (const table of schema.tables) {
    for (const [fieldName, field] of Object.entries(table.fields)) {
      if (!field.references) continue
      const targetTable = resolveReferencedTable(field.references.model, schema)
      const targetField = resolveReferencedField(targetTable, field.references.field)
      const pairKey = `${table.pascalName}->${targetTable.pascalName}`
      const isMultiple = (pairCounts.get(pairKey) || 0) > 1

      const relationName = isMultiple ? `${toCamelCase(table.pascalName)}_${fieldName}` : undefined

      // Derive forward relation field name on source model
      let relationFieldName = fieldName.replace(/(_id|Id)$/, "")
      if (!relationFieldName || relationFieldName === fieldName) {
        relationFieldName = toCamelCase(targetTable.pascalName)
      }
      if (table.fields[relationFieldName] && relationFieldName !== fieldName) {
        relationFieldName = `${relationFieldName}Rel`
      }

      // Derive back relation field name on target model
      const isOneToOne = field.unique === true
      const baseBackName = isOneToOne
        ? toCamelCase(table.pascalName)
        : pluralize(toCamelCase(table.pascalName))

      let backRelationsSet = usedBackRelations.get(targetTable.pascalName)
      if (!backRelationsSet) {
        backRelationsSet = new Set<string>()
        usedBackRelations.set(targetTable.pascalName, backRelationsSet)
      }

      let backRelationFieldName = baseBackName
      if (isMultiple) {
        backRelationFieldName = isOneToOne
          ? `${baseBackName}_${fieldName}`
          : `${baseBackName}_${fieldName}`
      }
      if (
        targetTable.fields[backRelationFieldName] ||
        backRelationsSet.has(backRelationFieldName)
      ) {
        let suffix = 2
        while (
          targetTable.fields[`${backRelationFieldName}${suffix}`] ||
          backRelationsSet.has(`${backRelationFieldName}${suffix}`)
        ) {
          suffix++
        }
        backRelationFieldName = `${backRelationFieldName}${suffix}`
      }
      backRelationsSet.add(backRelationFieldName)

      relations.push({
        sourceTable: table,
        sourceField: fieldName,
        targetTable,
        targetField,
        relationFieldName,
        backRelationFieldName,
        relationName,
        isOneToOne,
        onDelete: field.references.onDelete,
        required: field.required !== false,
      })
    }
  }

  return relations
}

interface FieldLine {
  name: string
  type: string
  attributes: string
}

function renderModel(
  table: NormalizedTable,
  schema: NormalizedSchema,
  idStrategy: IdStrategy,
  relations: RelationInfo[],
): string {
  const lines: FieldLine[] = []

  // 1. Primary key column
  lines.push(renderIdField(table, idStrategy))

  // 2. Regular fields (excluding id)
  for (const [fieldName, field] of Object.entries(table.fields)) {
    if (fieldName === "id") continue
    lines.push(renderField(fieldName, field, idStrategy))
  }

  // 3. Outgoing relation fields on this model
  const outgoing = relations.filter((r) => r.sourceTable === table)
  for (const rel of outgoing) {
    lines.push(renderOutgoingRelation(rel))
  }

  // 4. Incoming (back) relation fields on this model
  const incoming = relations.filter((r) => r.targetTable === table)
  for (const rel of incoming) {
    lines.push(renderIncomingRelation(rel))
  }

  // Determine column widths for aligned formatting
  const maxNameLen = Math.max(...lines.map((l) => l.name.length))
  const maxTypeLen = Math.max(...lines.map((l) => l.type.length))

  const formattedFields = lines.map((l) => {
    const namePadded = l.name.padEnd(maxNameLen, " ")
    if (!l.attributes) {
      return `  ${namePadded} ${l.type}`
    }
    const typePadded = l.type.padEnd(maxTypeLen, " ")
    return `  ${namePadded} ${typePadded} ${l.attributes}`
  })

  // Table-level directives: @@map and @@index
  const tableDirectives: string[] = []

  tableDirectives.push(`  @@map("${table.modelName}")`)

  for (const [fieldName, field] of Object.entries(table.fields)) {
    if (field.index) {
      tableDirectives.push(`  @@index([${fieldName}])`)
    }
  }

  const allLines = [...formattedFields]
  if (tableDirectives.length > 0) {
    allLines.push("", ...tableDirectives)
  }

  return `model ${table.pascalName} {\n${allLines.join("\n")}\n}`
}

function renderIdField(table: NormalizedTable, idStrategy: IdStrategy): FieldLine {
  const idField = table.fields.id
  const fieldName = "id"
  const mapAttr =
    idField?.fieldName && idField.fieldName !== "id" ? ` @map("${idField.fieldName}")` : ""

  if (idStrategy === "number" || idStrategy === "serial") {
    return {
      name: fieldName,
      type: "Int",
      attributes: `@id @default(autoincrement())${mapAttr}`,
    }
  }

  if (idStrategy === "uuid") {
    return {
      name: fieldName,
      type: "String",
      attributes: `@id @default(uuid())${mapAttr}`,
    }
  }

  if (idStrategy === "cuid") {
    return {
      name: fieldName,
      type: "String",
      attributes: `@id @default(cuid())${mapAttr}`,
    }
  }

  if (idStrategy === "nanoid") {
    return {
      name: fieldName,
      type: "String",
      attributes: `@id @default(nanoid())${mapAttr}`,
    }
  }

  return {
    name: fieldName,
    type: "String",
    attributes: `@id${mapAttr}`,
  }
}

function renderField(fieldName: string, field: FieldAttribute, idStrategy: IdStrategy): FieldLine {
  const typeStr = resolvePrismaType(fieldName, field, idStrategy)
  const isArray = typeStr.endsWith("[]")
  const isOptional = field.required === false && !isArray
  const fullType = isOptional ? `${typeStr}?` : typeStr

  const attrs: string[] = []

  if (field.unique) {
    attrs.push("@unique")
  }

  const defaultAttr = resolveDefaultAttribute(fieldName, field)
  if (defaultAttr) {
    attrs.push(defaultAttr)
  }

  if (field.fieldName && field.fieldName !== fieldName) {
    attrs.push(`@map("${field.fieldName}")`)
  }

  return {
    name: fieldName,
    type: fullType,
    attributes: attrs.join(" "),
  }
}

function resolvePrismaType(
  fieldName: string,
  field: FieldAttribute,
  idStrategy: IdStrategy,
): string {
  if (field.references?.field === "id") {
    if (idStrategy === "number" || idStrategy === "serial") {
      return "Int"
    }
    return "String"
  }

  if (field.type === "json") return "Json"
  if (field.type === "string[]") return "String[]"
  if (field.type === "number[]") return "Int[]"
  if (Array.isArray(field.type)) return "String"

  switch (field.type as FieldType) {
    case "string":
      return "String"
    case "number":
      return field.bigint ? "BigInt" : "Int"
    case "boolean":
      return "Boolean"
    case "date":
      return "DateTime"
    default:
      return "String"
  }
}

function resolveDefaultAttribute(fieldName: string, field: FieldAttribute): string | undefined {
  if (field.type === "date") {
    const isUpdatedAt = fieldName === "updatedAt" || field.fieldName === "updatedAt"
    const hasFnDefault = typeof field.defaultValue === "function"

    if (isUpdatedAt && hasFnDefault) {
      return "@default(now()) @updatedAt"
    }
    if (isUpdatedAt) {
      return "@updatedAt"
    }
    if (hasFnDefault) {
      return "@default(now())"
    }
  }

  if (typeof field.defaultValue === "boolean") {
    return `@default(${field.defaultValue})`
  }

  if (typeof field.defaultValue === "function") {
    try {
      const val = field.defaultValue()
      if (typeof val === "boolean") {
        return `@default(${val})`
      }
      if (typeof val === "number") {
        return `@default(${val})`
      }
      if (typeof val === "string") {
        return `@default("${val}")`
      }
    } catch {
      // Ignore evaluation failure
    }
  }

  if (typeof field.defaultValue === "number") {
    return `@default(${field.defaultValue})`
  }

  if (typeof field.defaultValue === "string") {
    return `@default("${field.defaultValue}")`
  }

  return undefined
}

function renderOutgoingRelation(rel: RelationInfo): FieldLine {
  const isOptional = !rel.required
  const fullType = isOptional ? `${rel.targetTable.pascalName}?` : rel.targetTable.pascalName

  const parts: string[] = []
  if (rel.relationName) {
    parts.push(`"${rel.relationName}"`)
  }
  parts.push(`fields: [${rel.sourceField}]`)
  parts.push(`references: [${rel.targetField}]`)

  if (rel.onDelete) {
    const onDeleteMap: Record<string, string> = {
      cascade: "Cascade",
      "set null": "SetNull",
      restrict: "Restrict",
      "no action": "NoAction",
      "set default": "SetDefault",
    }
    const prismaOnDelete = onDeleteMap[rel.onDelete.toLowerCase()] || "Cascade"
    parts.push(`onDelete: ${prismaOnDelete}`)
  }

  return {
    name: rel.relationFieldName,
    type: fullType,
    attributes: `@relation(${parts.join(", ")})`,
  }
}

function renderIncomingRelation(rel: RelationInfo): FieldLine {
  if (rel.isOneToOne) {
    const fullType = `${rel.sourceTable.pascalName}?`
    const attr = rel.relationName ? `@relation("${rel.relationName}")` : ""
    return {
      name: rel.backRelationFieldName,
      type: fullType,
      attributes: attr,
    }
  }

  const fullType = `${rel.sourceTable.pascalName}[]`
  const attr = rel.relationName ? `@relation("${rel.relationName}")` : ""
  return {
    name: rel.backRelationFieldName,
    type: fullType,
    attributes: attr,
  }
}

function resolveReferencedTable(modelName: string, schema: NormalizedSchema): NormalizedTable {
  const target =
    schema.byAlias.get(modelName) ||
    schema.byModelName.get(modelName) ||
    schema.byPascalName.get(modelName)
  if (!target) {
    throw new Error(
      `[unadapter] Prisma generation could not resolve referenced model "${modelName}".`,
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
    `[unadapter] Prisma generation could not resolve referenced field "${fieldName}" on model "${table.modelName}".`,
  )
}

function toPascalCase(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_$]/g, "_")
  return (
    sanitized
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") || "Table"
  )
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function pluralize(value: string): string {
  if (/(s|x|z|ch|sh)$/i.test(value)) {
    return `${value}es`
  }
  if (/[^aeiou]y$/i.test(value)) {
    return `${value.slice(0, -1)}ies`
  }
  return `${value}s`
}
