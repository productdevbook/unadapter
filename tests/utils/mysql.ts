import type { Pool } from "mysql2/promise"
import { createPool } from "mysql2/promise"

const ADMIN_URL = "mysql://user:password@localhost:3306"

export interface MysqlIsolatedDb {
  url: string
  setup: () => Promise<void>
  teardown: () => Promise<void>
}

/**
 * Provides per-suite MySQL isolation. Each suite drops + recreates its
 * own database so suites can run in any order and parallel without
 * stepping on each other. Requires the test mysql user to have grant
 * on `better_auth%`.* (see tests/docker/mysql-init.sql).
 */
export function isolatedMysqlDb(name: string): MysqlIsolatedDb {
  const dbName = `better_auth_${name}`
  let admin: Pool | null = null
  return {
    url: `mysql://user:password@localhost:3306/${dbName}`,
    async setup() {
      admin = createPool(ADMIN_URL)
      await admin.query(`DROP DATABASE IF EXISTS ${dbName}`)
      await admin.query(`CREATE DATABASE ${dbName}`)
    },
    async teardown() {
      if (!admin) return
      await admin.query(`DROP DATABASE IF EXISTS ${dbName}`)
      await admin.end()
      admin = null
    },
  }
}
