CREATE TABLE IF NOT EXISTS simulator_campaigns (
  campaign_id uuid PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS simulator_actors (
  campaign_id uuid NOT NULL REFERENCES simulator_campaigns(campaign_id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  profile jsonb NOT NULL,
  PRIMARY KEY (campaign_id, actor_id)
);
CREATE TABLE IF NOT EXISTS simulator_credentials (
  campaign_id uuid NOT NULL,
  actor_id text NOT NULL,
  credential_hash bytea NOT NULL UNIQUE,
  PRIMARY KEY (campaign_id, actor_id),
  FOREIGN KEY (campaign_id, actor_id) REFERENCES simulator_actors(campaign_id, actor_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS simulator_sessions (
  session_hash bytea PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES simulator_campaigns(campaign_id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (campaign_id, actor_id) REFERENCES simulator_actors(campaign_id, actor_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS simulator_sessions_actor_idx ON simulator_sessions(campaign_id, actor_id);
CREATE TABLE IF NOT EXISTS simulator_profiles (
  campaign_id uuid NOT NULL REFERENCES simulator_campaigns(campaign_id) ON DELETE CASCADE,
  profile_revision text NOT NULL,
  profile jsonb NOT NULL,
  PRIMARY KEY (campaign_id, profile_revision)
);
CREATE TABLE IF NOT EXISTS simulator_sections (
  campaign_id uuid NOT NULL REFERENCES simulator_campaigns(campaign_id) ON DELETE CASCADE,
  course_id text NOT NULL,
  section_id text NOT NULL,
  capacity integer NOT NULL CHECK (capacity >= 0),
  occupied integer NOT NULL DEFAULT 0 CHECK (occupied >= 0 AND occupied <= capacity),
  course jsonb NOT NULL,
  section jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (campaign_id, course_id, section_id)
);
CREATE TABLE IF NOT EXISTS simulator_academic_sessions (
  session_id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL,
  actor_id text NOT NULL,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  FOREIGN KEY (campaign_id, actor_id) REFERENCES simulator_actors(campaign_id, actor_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS simulator_requests (
  campaign_id uuid NOT NULL,
  actor_id text NOT NULL,
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  outcome jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, actor_id, request_id),
  FOREIGN KEY (campaign_id, actor_id) REFERENCES simulator_actors(campaign_id, actor_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS simulator_enrollments (
  campaign_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  actor_id text NOT NULL,
  request_id uuid NOT NULL,
  profile_revision text NOT NULL,
  accepted_at timestamptz NOT NULL,
  PRIMARY KEY (campaign_id, enrollment_id),
  UNIQUE (campaign_id, actor_id),
  FOREIGN KEY (campaign_id, actor_id) REFERENCES simulator_actors(campaign_id, actor_id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id, actor_id, request_id) REFERENCES simulator_requests(campaign_id, actor_id, request_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS simulator_enrollment_items (
  campaign_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  course_id text NOT NULL,
  section_id text NOT NULL,
  PRIMARY KEY (campaign_id, enrollment_id, course_id),
  FOREIGN KEY (campaign_id, enrollment_id) REFERENCES simulator_enrollments(campaign_id, enrollment_id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id, course_id, section_id) REFERENCES simulator_sections(campaign_id, course_id, section_id)
);
CREATE TABLE IF NOT EXISTS simulator_reports (
  campaign_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  report jsonb NOT NULL,
  PRIMARY KEY (campaign_id, enrollment_id),
  FOREIGN KEY (campaign_id, enrollment_id) REFERENCES simulator_enrollments(campaign_id, enrollment_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS simulator_rate_limits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY (bucket_key, window_start)
);
CREATE TABLE IF NOT EXISTS simulator_http_metrics (
  bucket_start timestamptz NOT NULL,
  method text NOT NULL,
  route text NOT NULL,
  status integer NOT NULL,
  count integer NOT NULL DEFAULT 0,
  duration_total_ms double precision NOT NULL DEFAULT 0,
  duration_max_ms double precision NOT NULL DEFAULT 0,
  PRIMARY KEY(bucket_start,method,route,status)
);
CREATE TABLE IF NOT EXISTS simulator_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
