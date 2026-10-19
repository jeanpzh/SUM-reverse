import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { assertSyntheticDatabase } from './synthetic-database.js'

assertSyntheticDatabase(process.env.DATABASE_URL)
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, application_name: 'sum-simulator-migrations' })
const here = dirname(fileURLToPath(import.meta.url))
try {
  await pool.query('CREATE TABLE IF NOT EXISTS simulator_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  const sourceMigrations = resolve(here, '../migrations')
  const distMigrations = resolve(here, '../../migrations')
  let migrationDirectory = sourceMigrations
  try { await access(migrationDirectory) } catch { migrationDirectory = distMigrations }
  const files = (await readdir(migrationDirectory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort()
  for (const file of files) {
    const exists = await pool.query('SELECT 1 FROM simulator_schema_migrations WHERE version = $1', [file])
    if (exists.rowCount) continue
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(await readFile(resolve(migrationDirectory, file), 'utf8'))
      await client.query('INSERT INTO simulator_schema_migrations(version) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
} finally { await pool.end() }
