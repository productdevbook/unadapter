import type { FieldAttribute } from "../types/index.ts"

/**
 * Map a logical record (keyed by field name as defined in the schema)
 * to the DB-facing column names (`field.fieldName`). Skips undefined
 * values so partial updates only set the fields the caller specified.
 */
export function convertToDB<T extends Record<string, any>>(
  fields: Record<string, FieldAttribute>,
  values: T,
): T {
  const result: Record<string, any> = values.id ? { id: values.id } : {}
  for (const key in fields) {
    const field = fields[key]
    if (!field) continue
    const value = values[key]
    if (value === undefined) continue
    result[field.fieldName || key] = value
  }
  return result as T
}

/**
 * Inverse of {@link convertToDB}: rehydrate a DB row into the logical
 * record by applying the inverse `field.fieldName → key` mapping.
 */
export function convertFromDB<T extends Record<string, any>>(
  fields: Record<string, FieldAttribute>,
  values: T | null,
): T | null {
  if (!values) return null
  const result: Record<string, any> = { id: values.id }
  for (const [key, field] of Object.entries(fields)) {
    result[key] = values[field.fieldName || key]
  }
  return result as T
}
