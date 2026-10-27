import type { FieldAttribute, Where } from "../types/index.ts"

function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Reject where values that a driver could interpret as a query operator
 * instead of a literal, e.g. `{ $ne: "" }` (MongoDB) or `{ not: "" }`
 * (Prisma). Class instances such as `Date` or `ObjectId` are allowed.
 */
export function assertSafeWhereValue(where: Pick<Where, "field" | "operator" | "value">): void {
  const { field, operator, value } = where
  const values = Array.isArray(value) ? value : [value]
  for (const v of values) {
    if (isPlainObject(v) || Array.isArray(v)) {
      throw new TypeError(`Invalid value for where field "${field}": objects are not allowed`)
    }
  }
  if (
    (operator === "contains" || operator === "starts_with" || operator === "ends_with") &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "bigint"
  ) {
    throw new TypeError(`Invalid value for where field "${field}": "${operator}" expects a string`)
  }
}

/**
 * Single-row `update` / `delete` must be scoped. An empty where clause
 * would otherwise touch every row in the table.
 */
export function assertNonEmptyWhere(method: string, model: string, where?: Where[]): void {
  if (!where || where.length === 0) {
    throw new Error(
      `${method} on "${model}" requires a non-empty where clause. Use ${method}Many to target every row.`,
    )
  }
}

export function withApplyDefault(
  value: any,
  field: FieldAttribute,
  action: "create" | "update",
): any {
  if (action === "update") {
    return value
  }
  if (value === undefined || value === null) {
    if (field.defaultValue) {
      if (typeof field.defaultValue === "function") {
        return field.defaultValue()
      }
      return field.defaultValue
    }
  }
  return value
}
