import type { AdapterOptions, FieldAttribute } from "../types/index.ts"

export interface MergedPluginSchema {
  [tableName: string]: {
    fields: Record<string, FieldAttribute>
    modelName: string
  }
}

/**
 * Returns `MergedPluginSchema | undefined` at runtime; declared as `any`
 * so callers can spread `result?.user?.fields` into a stricter
 * `TablesSchema` shape without TypeScript narrowing the spread to
 * `string | FieldAttribute` (which conflicts with consumer-supplied
 * config fields like `options?.user?.fields?.name: string | undefined`).
 */
export function mergePluginSchemas<
  T extends Record<string, any>,
  K extends keyof AdapterOptions<T> = "plugins",
>(options: AdapterOptions<T>, where: K = "plugins" as K): any {
  const schema = (options[where] as any[])?.reduce(
    (acc, plugin) => {
      const schema = plugin.schema
      if (!schema) return acc
      for (const [key, value] of Object.entries(schema)) {
        acc[key] = {
          fields: {
            ...acc[key]?.fields,
            ...(typeof value === "object" && value !== null && "fields" in value
              ? (value.fields as unknown as Record<string, FieldAttribute>)
              : {}),
          },
          modelName:
            (typeof value === "object" && value !== null && "modelName" in value
              ? String(value.modelName)
              : key) || key,
        }
      }
      return acc
    },
    {} as MergedPluginSchema,
  )

  return schema
}
