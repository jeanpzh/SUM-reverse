import { Pool } from 'pg'

export function createSimulatorPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL simulator mode')
  const lockTimeoutMs = Number(process.env.SIMULATOR_DB_LOCK_TIMEOUT_MS ?? 5000)
  const statementTimeoutMs = Number(process.env.SIMULATOR_DB_STATEMENT_TIMEOUT_MS ?? 20000)
  return new Pool({
    connectionString,
    max: Number(process.env.SIMULATOR_DB_POOL_MAX ?? 12),
    connectionTimeoutMillis: Number(process.env.SIMULATOR_DB_CONNECT_TIMEOUT_MS ?? 5000),
    idleTimeoutMillis: 30000,
    application_name: 'sum-simulator',
    options: `-c lock_timeout=${lockTimeoutMs} -c statement_timeout=${statementTimeoutMs}`,
  })
}

export const SIMULATOR_POOL = Symbol('SIMULATOR_POOL')
