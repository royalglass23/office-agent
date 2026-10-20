CREATE TABLE IF NOT EXISTS company_check_reports (
  report_id uuid PRIMARY KEY,
  account_uuid uuid NOT NULL,
  created_by_staff_uuid uuid NOT NULL,
  request_key uuid NOT NULL,
  company_number text,
  checked_at timestamptz NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  review_due_at timestamptz NOT NULL,
  report jsonb NOT NULL,
  UNIQUE (account_uuid, request_key)
);

CREATE INDEX IF NOT EXISTS company_check_reports_account_saved_idx
  ON company_check_reports (account_uuid, saved_at DESC);
CREATE INDEX IF NOT EXISTS company_check_reports_account_company_idx
  ON company_check_reports (account_uuid, company_number, saved_at DESC);

CREATE TABLE IF NOT EXISTS company_check_research_requests (
  account_uuid uuid NOT NULL,
  request_key uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_uuid, request_key)
);

CREATE TABLE IF NOT EXISTS company_check_property_results (
  report_id uuid NOT NULL REFERENCES company_check_reports(report_id) ON DELETE CASCADE,
  project_key text NOT NULL,
  result jsonb NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, project_key)
);

CREATE TABLE IF NOT EXISTS company_check_property_cache (
  address_hash text PRIMARY KEY,
  result jsonb NOT NULL,
  fetched_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS company_check_lookup_spacing (
  name text PRIMARY KEY,
  next_lookup_at timestamptz NOT NULL
);
