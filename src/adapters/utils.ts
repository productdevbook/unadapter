import type { FieldAttribute } from 'unadapter/types'

export function withApplyDefault(
  value: any,
  field: FieldAttribute,
  action: 'create' | 'update',
) {
  if (action === 'update') {
    return value
  }
  if (value === undefined || value === null) {
    if (field.defaultValue) {
      if (typeof field.defaultValue === 'function') {
        return field.defaultValue()
      }
      return field.defaultValue
    }
  }
  return value
}
