import { Pool } from 'pg';

export interface AssessmentRecord {
  partner_id: string;
  company_name: string;
  customer_id: string;
  customer_name: string;
  location: string;
  assessment_value: number;
  status: string;
}

export class PartnerSalesTracker {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  async recordAssessment(
    partner_id: string,
    company_name: string,
    customer_id: string,
    customer_name: string,
    location: string,
    assessment_value: number,
    revenue_share_percent: number
  ): Promise<AssessmentRecord> {
    try {
      const query = `
        INSERT INTO partner_assessments 
        (partner_id, customer_id, customer_name, location, assessment_date, status)
        VALUES ($1, $2, $3, $4, NOW(), 'completed')
        RETURNING *
      `;

      const result = await this.db.query(query, [
        partner_id,
        customer_id,
        customer_name,
        location,
      ]);

      console.log(`[PartnerSalesTracker] Assessment recorded: ${customer_id}`);

      // Update partner metrics
      await this.updatePartnerMetrics(partner_id, assessment_value);

      return {
        partner_id,
        company_name,
        customer_id,
        customer_name,
        location,
        assessment_value,
        status: 'completed',
      };
    } catch (error: any) {
      console.error(`[PartnerSalesTracker] Error: ${error.message}`);
      throw error;
    }
  }

  private async updatePartnerMetrics(
    partner_id: string,
    assessment_value: number
  ): Promise<void> {
    const query = `
      UPDATE partners 
      SET monthly_revenue = monthly_revenue + $1
      WHERE partner_id = $2
    `;

    await this.db.query(query, [assessment_value, partner_id]);
  }

  async getPartnerStats(partner_id: string): Promise<any> {
    const query = `
      SELECT 
        p.partner_id,
        p.company_name,
        COUNT(pa.id) as assessments_count,
        SUM(pi.partner_earnings) as total_earnings,
        p.monthly_revenue
      FROM partners p
      LEFT JOIN partner_assessments pa ON p.partner_id = pa.partner_id
      LEFT JOIN partner_invoices pi ON p.partner_id = pi.partner_id
      WHERE p.partner_id = $1
      GROUP BY p.partner_id, p.company_name, p.monthly_revenue
    `;

    const result = await this.db.query(query, [partner_id]);
    return result.rows[0] || null;
  }

  async getAllPartners(): Promise<any[]> {
    const query = `
      SELECT partner_id, company_name, monthly_revenue, success_fee_earned
      FROM partners
      ORDER BY monthly_revenue DESC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }
}
