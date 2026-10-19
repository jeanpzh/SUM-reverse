export function assertSyntheticDatabase(connectionString: string | undefined) {
  if (!connectionString) throw new Error('DATABASE_URL is required')
  if (process.env.SIMULATOR_DATA_PROVENANCE !== 'independently-synthetic') throw new Error('Set SIMULATOR_DATA_PROVENANCE=independently-synthetic only for the dedicated synthetic database')
  const database = new URL(connectionString).pathname.replace(/^\//, '')
  if (database !== 'sum_simulator_synthetic') throw new Error('Administrative scripts are restricted to the sum_simulator_synthetic database')
}
