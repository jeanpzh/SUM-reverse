import { Pool } from 'pg'
import { assertSyntheticDatabase } from './synthetic-database.js'

const connectionString = process.env.DATABASE_URL
const campaignId = process.env.SIMULATOR_CAMPAIGN_ID
const closeCampaign = process.env.SIMULATOR_CLOSE_CAMPAIGN === '1'
if (!connectionString || !campaignId) throw new Error('DATABASE_URL and SIMULATOR_CAMPAIGN_ID are required')
assertSyntheticDatabase(connectionString)
const pool = new Pool({ connectionString, max: 1, application_name: 'sum-simulator-audit' })
try {
  const campaign = await pool.query<{ status: string }>('SELECT status FROM simulator_campaigns WHERE campaign_id=$1', [campaignId])
  if (!campaign.rowCount) throw new Error('Campaign does not exist')
  const checks = await pool.query<{ name: string; violations: string }>(`SELECT 'capacity_bounds' name, count(*)::text violations FROM simulator_sections WHERE campaign_id=$1 AND (occupied<0 OR occupied>capacity)
    UNION ALL SELECT 'occupied_matches_items', count(*)::text FROM simulator_sections s WHERE s.campaign_id=$1 AND s.occupied <> (SELECT count(*) FROM simulator_enrollment_items i WHERE i.campaign_id=s.campaign_id AND i.course_id=s.course_id AND i.section_id=s.section_id)
    UNION ALL SELECT 'enrollment_details_nonempty', count(*)::text FROM simulator_enrollments e WHERE e.campaign_id=$1 AND NOT EXISTS (SELECT 1 FROM simulator_enrollment_items i WHERE i.campaign_id=e.campaign_id AND i.enrollment_id=e.enrollment_id)
    UNION ALL SELECT 'report_per_enrollment', abs((SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)-(SELECT count(*) FROM simulator_reports WHERE campaign_id=$1))::text
    UNION ALL SELECT 'accepted_request_per_enrollment', abs((SELECT count(*) FROM simulator_requests WHERE campaign_id=$1 AND outcome->>'state'='accepted')-(SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1))::text
    UNION ALL SELECT 'enrollment_request_report_links', count(*)::text FROM simulator_enrollments e JOIN simulator_requests q USING(campaign_id,actor_id,request_id) LEFT JOIN simulator_reports r USING(campaign_id,enrollment_id) WHERE e.campaign_id=$1 AND (q.outcome->>'state'<>'accepted' OR q.outcome->>'enrollmentId'<>e.enrollment_id::text OR r.enrollment_id IS NULL OR r.report->>'requestId'<>e.request_id::text OR r.report->>'actorId'<>e.actor_id)
    UNION ALL SELECT 'rejected_requests_have_no_effects', count(*)::text FROM simulator_requests q WHERE q.campaign_id=$1 AND q.outcome->>'state'<>'accepted' AND ((q.outcome->>'enrollmentId') IS NOT NULL OR EXISTS(SELECT 1 FROM simulator_enrollments e WHERE e.campaign_id=q.campaign_id AND e.actor_id=q.actor_id AND e.request_id=q.request_id))
    UNION ALL SELECT 'details_match_outcome_selection', count(*)::text FROM simulator_enrollments e JOIN simulator_requests q USING(campaign_id,actor_id,request_id) WHERE e.campaign_id=$1 AND ((SELECT count(*) FROM simulator_enrollment_items i WHERE i.campaign_id=e.campaign_id AND i.enrollment_id=e.enrollment_id) <> jsonb_array_length(q.outcome->'selection') OR EXISTS(SELECT 1 FROM jsonb_array_elements(q.outcome->'selection') selected WHERE NOT EXISTS(SELECT 1 FROM simulator_enrollment_items i WHERE i.campaign_id=e.campaign_id AND i.enrollment_id=e.enrollment_id AND i.course_id=selected->>'courseId' AND i.section_id=selected->>'sectionId')))`, [campaignId])
  const stats = await pool.query<{ actors: string; sections: string; capacity: string; occupied: string; requests: string; enrollments: string; reports: string }>(`SELECT
    (SELECT count(*) FROM simulator_actors WHERE campaign_id=$1)::text actors,
    (SELECT count(*) FROM simulator_sections WHERE campaign_id=$1)::text sections,
    (SELECT coalesce(sum(capacity),0) FROM simulator_sections WHERE campaign_id=$1)::text capacity,
    (SELECT coalesce(sum(occupied),0) FROM simulator_sections WHERE campaign_id=$1)::text occupied,
    (SELECT count(*) FROM simulator_requests WHERE campaign_id=$1)::text requests,
    (SELECT count(*) FROM simulator_enrollments WHERE campaign_id=$1)::text enrollments,
    (SELECT count(*) FROM simulator_reports WHERE campaign_id=$1)::text reports`, [campaignId])
  const outcomes = [...checks.rows]
  const expectedEnrollments = process.env.EXPECTED_ENROLLMENTS
  const expectedRequests = process.env.EXPECTED_REQUESTS
  if (expectedEnrollments !== undefined && Number(stats.rows[0]!.enrollments) !== Number(expectedEnrollments)) outcomes.push({ name: 'expected_enrollments', violations: '1' })
  if (expectedRequests !== undefined && Number(stats.rows[0]!.requests) !== Number(expectedRequests)) outcomes.push({ name: 'expected_requests', violations: '1' })
  const violations = outcomes.filter((check) => Number(check.violations) !== 0)
  if (closeCampaign && violations.length === 0) {
    await pool.query("UPDATE simulator_campaigns SET status='closed',closed_at=coalesce(closed_at,now()) WHERE campaign_id=$1", [campaignId])
  }
  process.stdout.write(`${JSON.stringify({ campaignStatus: closeCampaign && violations.length === 0 ? 'closed' : campaign.rows[0]!.status, totals: stats.rows[0], checks: outcomes, passed: violations.length === 0 }, null, 2)}\n`)
  if (violations.length) process.exitCode = 1
} finally { await pool.end() }
