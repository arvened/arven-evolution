FILE #24: docs/API.md

# 🔌 API Reference

## Base URL



http://localhost:3000


## Health Endpoints

### Health Check


GET /health


Response:
```json
{
  "status": "healthy",
  "service": "arven-evolution-v3.0",
  "timestamp": "2026-06-13T10:30:00Z"
}


Deep Health Check

GET /health/deep


Checks database connectivity.

Audit Endpoints

Run Audit

POST /api/audit/run


Request:

{
  "audit_id": "audit-001",
  "company_name": "My Company",
  "company_location": "PL",
  "codebase_url": "https://github.com/company/repo",
  "metadata": {
    "language": "python",
    "framework": "fastapi",
    "team_size": 10
  }
}


Response:

{
  "success": true,
  "data": {
    "audit_id": "audit-001",
    "final_score": 76.75,
    "verdict": "PARTIAL",
    "component_scores": {
      "code_quality": 78,
      "architecture": 75,
      "performance": 82,
      "security": 72
    },
    "recommendations": [...]
  }
}


Get Audit Result

GET /api/audit/:audit_id


Get Statistics

GET /api/audit/stats/all


Security Endpoints

Security Assessment

POST /api/security/audit/security-assessment


Request:

{
  "audit_id": "audit-001",
  "company_name": "Company",
  "location": "PL"
}


Response:

{
  "audit_id": "audit-001",
  "security_score": 72,
  "verdict": "PARTIAL",
  "vulnerability_summary": {
    "critical": 1,
    "high": 3,
    "medium": 5,
    "low": 2
  },
  "compliance_gaps": [...],
  "red_team_report": {...}
}


Security Health

GET /api/security/health


Security Metrics

GET /api/security/metrics


Partner Endpoints

Record Assessment

POST /api/partners/assessments


Request:

{
  "partner_id": "covent-001",
  "customer_id": "cust-123",
  "customer_name": "Customer Inc",
  "location": "PL",
  "assessment_value": 5000
}


Partner Stats

GET /api/partners/stats


Dashboard Endpoints

Edward Dashboard

GET /api/dashboards/edward


Response:

{
  "total_partners": 5,
  "total_platform_revenue": 150000,
  "total_arven_earnings": 75000,
  "total_assessments": 245,
  "average_audit_score": 76.5
}


Partner Dashboard

GET /api/dashboards/partner/:partner_id


Response:

{
  "partner_id": "covent-001",
  "company_name": "Covent Tech",
  "total_assessments": 50,
  "total_revenue": 250000,
  "total_earnings": 125000,
  "monthly_revenue": 25000
}


Webhook Endpoints

Webhook Callback

POST /api/audit/webhook-callback/:audit_id


Headers:

Authorization: Bearer {webhook_secret}
X-Webhook-ID: evt_xxx


Payload:

{
  "audit_id": "audit-001",
  "security_score": 72,
  "verdict": "PARTIAL",
  "findings": {...},
  "timestamp": "2026-06-13T10:30:00Z"
}


Error Responses

400 Bad Request

{
  "success": false,
  "error": "Invalid audit_id format"
}


404 Not Found

{
  "success": false,
  "error": "Audit not found"
}


500 Internal Server Error

{
  "success": false,
  "error": "Database connection error"
}


Rate Limiting

Default: 1000 requests/hour

Authentication

Use API key in header:

Authorization: Bearer YOUR_API_KEY
