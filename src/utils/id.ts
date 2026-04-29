export function generateId(_size?: number): string {
  return crypto.randomUUID()
}
