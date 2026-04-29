import type { ZodType } from "zod"
import type { FieldAttribute } from "../types/index.ts"
import * as z from "zod"

/**
 * Build a Zod schema from a field map. Useful for validating request
 * payloads or building forms when you already have a TablesSchema fields
 * record.
 *
 * - `input: false` fields are removed when `isClientSide: true`
 * - `returned: false` fields are removed when `isClientSide: false`
 * - `required: false` fields become `optional()`
 */
export function toZodSchema<
  Fields extends Record<string, FieldAttribute>,
  IsClientSide extends boolean,
>({
  fields,
  isClientSide,
}: {
  fields: Fields
  isClientSide: IsClientSide
}): z.ZodObject<Record<string, ZodType>> {
  const zodFields: Record<string, ZodType> = {}
  for (const key of Object.keys(fields)) {
    const field = fields[key]
    if (!field) continue
    if (isClientSide && field.input === false) continue
    if (!isClientSide && field.returned === false) continue

    let schema: ZodType
    if (field.type === "json") {
      schema = (z as unknown as { json?: () => ZodType }).json?.() ?? z.any()
    } else if (field.type === "string[]") {
      schema = z.array(z.string())
    } else if (field.type === "number[]") {
      schema = z.array(z.number())
    } else if (Array.isArray(field.type)) {
      // Literal-union enum: accept any of the listed strings.
      schema = z.any()
    } else {
      switch (field.type) {
        case "string":
          schema = z.string()
          break
        case "number":
          schema = z.number()
          break
        case "boolean":
          schema = z.boolean()
          break
        case "date":
          schema = z.date()
          break
        default:
          schema = z.any()
      }
    }

    if (field.required === false) schema = schema.optional()

    zodFields[key] = schema
  }
  return z.object(zodFields)
}
