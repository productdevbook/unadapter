import type { Where } from "../src/types/index.ts"

const validFilters = [
  { field: "name", value: null },
  { field: "name", operator: "ne", value: "Ada" },
  { field: "createdAt", operator: "gte", value: new Date() },
  { field: "sequenceId", operator: "lt", value: 10 },
  { field: "email", operator: "in", value: ["ada@example.com"] },
  { field: "sequenceId", operator: "in", value: [1, 2] },
  { field: "email", operator: "contains", value: "@example.com" },
] satisfies Where[]

void validFilters

const invalidRangeFilter = {
  field: "createdAt",
  operator: "gt",
  value: null,
  // @ts-expect-error Range operators do not accept null.
} satisfies Where

const invalidInFilter = {
  field: "email",
  operator: "in",
  value: "ada@example.com",
  // @ts-expect-error The `in` operator requires an array value.
} satisfies Where

const invalidStringFilter = {
  field: "email",
  operator: "contains",
  value: new Date(),
  // @ts-expect-error String operators only accept strings.
} satisfies Where

void invalidRangeFilter
void invalidInFilter
void invalidStringFilter
