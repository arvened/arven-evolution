import { Pool } from 'pg';

export interface DashboardMetrics {
  partner_id: string;
  company_name: string;
  total_assessments: number;
  total_revenue: number;
  total_earnings: number;
  monthly_revenue: number;
  success_fee_earned: number;
  average_assessment_value: number;
  growth_percent: number;
  status: string;
}

export interface TopCustomers {
  customer_id: string;
  customer_name: string;
  location: string;
  assessment_count: number;
  total_value: number;
}

export class PartnerDashboard {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  async getPartnerDashboard(partner_id: string): Promise<DashboardMetrics> {
    const query = `
      SELECT 
        p.partner_id,
        p.company_name,
        COUNT(pa.id) as total_assessments,
        COALESCE(SUM(pi.invoice_amount), 0) as total_revenue,
        COALESCE(SUM(pi.partner_earnings), 0) as total_earnings,
        p.monthly_revenue,
        p.success_fee_earned,
        CASE 
          WHEN COUNT(pa.id) > 0 
          THEN COALESCE(SUM(pi.invoice_amount), 0) / COUNT(pa.id)
          ELSE 0
        END as average_assessment_value,
        p.status
      FROM partners p
      LEFT JOIN partner_assessments pa ON p.partner_id = pa.partner_id
      LEFT JOIN partner_invoices pi ON p.partner_id = pi.partner_id
      WHERE p.partner_id = $1
      GROUP BY p.partner_id, p.company_name, p.monthly_revenue, p.success_fee_earned, p.status
    `;

    const result = await this.db.query(query, [partner_id]);

    if (result.rows.length === 0) {
      throw new Error(`Partner not found: ${partner_id}`);
    }

    const row = result.rows[0];
    return {
      partner_id: row.partner_id,
      company_name: row.company_name,
      total_assessments: parseInt(row.total_assessments) || 0,
      total_revenue: parseFloat(row.total_revenue) || 0,
      total_earnings: parseFloat(row.total_earnings) || 0,
      monthly_revenue: parseFloat(row.monthly_revenue) || 0,
      success_fee_earned: parseFloat(row.success_fee_earned) || 0,
      average_assessment_value: parseFloat(row.average_assessment_value) || 0,
      growth_percent: 0,
      status: row.status,
    };
  }

  async getTopCustomers(partner_id: string, limit: number = 10): Promise<TopCustomers[]> {
    const query = `
      SELECT 
        pa.customer_id,
        pa.customer_name,
        pa.location,
        COUNT(pa.id) as assessment_count,
        COALESCE(SUM(pi.invoice_amount), 0) as total_value
      FROM partner_assessments pa
      LEFT JOIN partner_invoices pi ON pa.partner_id = pi.partner_id
      WHERE pa.partner_id = $1
      GROUP BY pa.customer_id, pa.customer_name, pa.location
      ORDER BY total_value DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [partner_id, limit]);
    return result.rows;
  }

  async getMonthlyTrend(partner_id: string, months: number = 12): Promise<any[]> {
    const query = `
      SELECT 
        DATE_TRUNC('month', pi.month) as month,
        COUNT(pa.id) as assessments,
        SUM(pi.invoice_amount) as revenue,
        SUM(pi.partner_earnings) as earnings
      FROM partner_invoices pi
      LEFT JOIN partner_assessments pa ON pi.partner_id = pa.partner_id
      WHERE pi.partner_id = $1
      AND pi.month >= NOW() - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', pi.month)
      ORDER BY month DESC
    `;

    const result = await this.db.query(query, [partner_id, months]);
    return result.rows;
  }

  async getEdwardDashboard(): Promise<any> {
    const query = `
      SELECT 
        COUNT(DISTINCT p.partner_id) as total_partners,
        SUM(p.monthly_revenue) as total_platform_revenue,
        SUM(pi.arven_earnings) as total_arven_earnings,
        COUNT(DISTINCT pa.id) as total_assessments,
        AVG(a.final_score) as average_audit_score
      FROM partners p
      LEFT JOIN partner_assessments pa ON p.partner_id = pa.partner_id
      LEFT JOIN partner_invoices pi ON p.partner_id = pi.partner_id
      LEFT JOIN audits a ON pa.audit_id = a.audit_id
      WHERE p.status = 'active'

      `;

    const result = await this.db.query(query);
    return result.rows[0];
  }

  async getPartnersList(): Promise<any[]> {
    const query = `
      SELECT 
        p.partner_id,
        p.company_name,
        p.location,
        p.status,
        COUNT(pa.id) as assessment_count,
        SUM(pi.partner_earnings) as total_earnings
      FROM partners p
      LEFT JOIN partner_assessments pa ON p.partner_id = pa.partner_id
      LEFT JOIN partner_invoices pi ON p.partner_id = pi.partner_id
      GROUP BY p.partner_id, p.company_name, p.location, p.status
      ORDER BY total_earnings DESC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }
}
