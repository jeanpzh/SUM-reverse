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
