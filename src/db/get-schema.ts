import type { AdapterOptions, FieldAttribute, UnDbSchema } from 'unadapter/types'

export function getSchema<T extends Record<string, any>>(
  config: AdapterOptions<T>,
  getTables: (options: AdapterOptions<T>) => UnDbSchema,
) {
  const tables = getTables(config as AdapterOptions<T>)
  const schema: Record<
    string,
    {
      fields: Record<string, FieldAttribute>
      order: number
    }
  > = {}
  for (const key in tables) {
    const table = tables[key]
    const fields = table.fields
    const actualFields: Record<string, FieldAttribute> = {}
    Object.entries(fields).forEach(([key, field]) => {
      actualFields[field.fieldName || key] = field
      if (field.references) {
        const refTable = tables[field.references.model]
        if (refTable) {
          actualFields[field.fieldName || key].references = {
            model: refTable.modelName,
            field: field.references.field,
          }
        }
      }
    })
    if (schema[table.modelName]) {
      schema[table.modelName].fields = {
        ...schema[table.modelName].fields,
        ...actualFields,
      }
      continue
    }
    schema[table.modelName] = {
      fields: actualFields,
      order: table.order || Infinity,
    }
  }
  return schema
}
