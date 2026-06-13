CREATE TABLE IF NOT EXISTS audits (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  company_location VARCHAR(10) NOT NULL,
  code_quality_score NUMERIC(5,2),
  architecture_score NUMERIC(5,2),
  performance_score NUMERIC(5,2),
  security_score NUMERIC(5,2),
  final_score NUMERIC(5,2),
  verdict VARCHAR(20),
  codebase_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_id (audit_id),
  INDEX idx_verdict (verdict)
);

CREATE TABLE IF NOT EXISTS audit_findings (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  finding_type VARCHAR(50),
  severity VARCHAR(20),
  description TEXT,
  remediation TEXT,
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  pattern_id VARCHAR(100),
  location VARCHAR(500),
  severity VARCHAR(20),
  description TEXT,
  cwe_ids VARCHAR(100),
  confidence NUMERIC(3,2),
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS compliance_gaps (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  requirement VARCHAR(50),
  gap_description TEXT,
  severity VARCHAR(20),
  remediation TEXT,
  estimated_effort_hours INT,
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS red_team_findings (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  attack_vector VARCHAR(100),
  success_rate NUMERIC(3,2),
  exploitability VARCHAR(20),
  impact VARCHAR(20),
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS partners (
  id BIGSERIAL PRIMARY KEY,
  partner_id VARCHAR(100) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  location VARCHAR(10),
  email VARCHAR(255),
  status VARCHAR(50),
  monthly_revenue NUMERIC(12,2) DEFAULT 0,
  success_fee_earned NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partner_id (partner_id),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS partner_assessments (
  id BIGSERIAL PRIMARY KEY,
  partner_id VARCHAR(100) NOT NULL,
  audit_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(100),
  customer_name VARCHAR(255),
  assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50),
  FOREIGN KEY (partner_id) REFERENCES partners(partner_id),
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS partner_invoices (
  id BIGSERIAL PRIMARY KEY,
  partner_id VARCHAR(100) NOT NULL,
  invoice_id VARCHAR(100) UNIQUE NOT NULL,
  month DATE NOT NULL,
  invoice_amount NUMERIC(12,2),
  success_fee NUMERIC(12,2),
  partner_earnings NUMERIC(12,2),
  arven_earnings NUMERIC(12,2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partners(partner_id),
  INDEX idx_month (month)
);

CREATE TABLE IF NOT EXISTS partner_payments (
  id BIGSERIAL PRIMARY KEY,
  partner_id VARCHAR(100) NOT NULL,
  invoice_id VARCHAR(100),
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  amount NUMERIC(12,2),
  status VARCHAR(50),
  FOREIGN KEY (partner_id) REFERENCES partners(partner_id),
  FOREIGN KEY (invoice_id) REFERENCES partner_invoices(invoice_id)
);

CREATE TABLE IF NOT EXISTS partner_sales_metrics (
  id BIGSERIAL PRIMARY KEY,
  partner_id VARCHAR(100) NOT NULL,
  month DATE NOT NULL,
  assessments_count INT DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  FOREIGN KEY (partner_id) REFERENCES partners(partner_id),
  INDEX idx_month (month)
);

CREATE TABLE IF NOT EXISTS compliance_gdpr (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  data_deletion_mechanism BOOLEAN,
  privacy_policy BOOLEAN,
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS compliance_ai_act (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  model_documentation BOOLEAN,
  risk_assessment BOOLEAN,
  risk_level VARCHAR(50),

FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS compliance_dsa (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  content_moderation BOOLEAN,
  transparency_report BOOLEAN,
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS compliance_nis2 (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255) NOT NULL,
  incident_response BOOLEAN,
  security_updates BOOLEAN,
  FOREIGN KEY (audit_id) REFERENCES audits(audit_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  audit_id VARCHAR(255),
  event_type VARCHAR(100),
  event_data JSONB,
  actor VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_id (audit_id)
);

CREATE VIEW v_audit_summary AS
SELECT
  a.audit_id,
  a.company_name,
  a.final_score,
  a.verdict,
  (SELECT COUNT(*) FROM vulnerabilities v WHERE v.audit_id = a.audit_id) as vuln_count,
  a.created_at
FROM audits a;

CREATE VIEW v_partner_revenue_summary AS
SELECT
  p.partner_id,
  p.company_name,
  COUNT(pa.id) as assessments_count,
  SUM(pi.partner_earnings) as total_earnings,
  MAX(pi.created_at) as last_invoice_date
FROM partners p
LEFT JOIN partner_assessments pa ON p.partner_id = pa.partner_id
LEFT JOIN partner_invoices pi ON p.partner_id = pi.partner_id
GROUP BY p.partner_id, p.company_name;

INSERT INTO partners (partner_id, company_name, location, status)
VALUES ('covent-001', 'Covent Tech', 'PL', 'active')
ON CONFLICT (partner_id) DO NOTHING;
