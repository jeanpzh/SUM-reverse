import { Pool } from 'pg'
import { assertSyntheticDatabase } from './synthetic-database.js'

const connectionString = process.env.DATABASE_URL
const campaignId = process.env.SIMULATOR_CLOSE_CAMPAIGN_ID
if (!connectionString || !campaignId || process.env.SIMULATOR_CONFIRM_CLOSE !== campaignId) throw new Error('Set DATABASE_URL, SIMULATOR_CLOSE_CAMPAIGN_ID, and SIMULATOR_CONFIRM_CLOSE to the same campaign UUID')
assertSyntheticDatabase(connectionString)
const pool = new Pool({ connectionString, max: 1, application_name: 'sum-simulator-close' })
try {
  const checks = await pool.query(`SELECT
    (SELECT count(*) FROM simulator_sections s WHERE s.campaign_id=$1 AND s.occupied<>(SELECT count(*) FROM simulator_enrollment_items i WHERE i.campaign_id=s.campaign_id AND i.course_id=s.course_id AND i.section_id=s.section_id)) +
    abs((SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)-(SELECT count(*) FROM simulator_reports WHERE campaign_id=$1)) +
    abs((SELECT count(*) FROM simulator_requests WHERE campaign_id=$1 AND outcome->>'state'='accepted')-(SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)) AS violations`, [campaignId])
  if (Number(checks.rows[0]?.violations ?? 1) !== 0) throw new Error('Campaign audit failed; it remains open')
  const closed = await pool.query("UPDATE simulator_campaigns SET status='closed',closed_at=now() WHERE campaign_id=$1 AND status='open' RETURNING status", [campaignId])
  if (!closed.rowCount) throw new Error('Campaign does not exist or is already closed')
  process.stdout.write('Closed audited synthetic campaign\n')
} finally { await pool.end() }
