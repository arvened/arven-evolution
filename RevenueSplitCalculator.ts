import { Pool } from 'pg';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  invoice_id: string;
  partner_id: string;
  month: Date;
  total_revenue: number;
  success_fee: number;
  partner_earnings: number;
  arven_earnings: number;
  status: string;
}

export class RevenueSplitCalculator {
  private db: Pool;
  private readonly REVENUE_SHARE_PERCENT = 0.15; // 15% success fee
  private readonly PARTNER_SPLIT = 0.5; // 50% to partner
  private readonly ARVEN_SPLIT = 0.5; // 50% to ARVEN

  constructor(database: Pool) {
    this.db = database;
  }

  calculateInvoice(
    partner_id: string,
    month: Date,
    monthly_revenue: number
  ): Invoice {
    const success_fee = monthly_revenue * this.REVENUE_SHARE_PERCENT;
    const partner_earnings = success_fee * this.PARTNER_SPLIT;
    const arven_earnings = success_fee * this.ARVEN_SPLIT;

    const invoice_id = INV-${partner_id}-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')};

    return {
      invoice_id,
      partner_id,
      month,
      total_revenue: monthly_revenue,
      success_fee: Math.round(success_fee * 100) / 100,
      partner_earnings: Math.round(partner_earnings * 100) / 100,
      arven_earnings: Math.round(arven_earnings * 100) / 100,
      status: 'generated',
    };
  }

  async saveInvoice(invoice: Invoice): Promise<Invoice> {
    try {
      const query = `
        INSERT INTO partner_invoices 
        (partner_id, invoice_id, month, invoice_amount, success_fee, partner_earnings, arven_earnings, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (invoice_id) DO UPDATE SET status = $8
        RETURNING *
      `;

      const result = await this.db.query(query, [
        invoice.partner_id,
        invoice.invoice_id,
        invoice.month,
        invoice.total_revenue,
        invoice.success_fee,
        invoice.partner_earnings,
        invoice.arven_earnings,
        invoice.status,
      ]);

      console.log(`[RevenueSplitCalculator] Invoice saved: ${invoice.invoice_id}`);
      return invoice;
    } catch (error: any) {
      console.error(`[RevenueSplitCalculator] Error: ${error.message}`);
      throw error;
    }
  }

  async generateMonthlyInvoices(): Promise<Invoice[]> {
    const partners = await this.db.query('SELECT * FROM partners WHERE status = $1', ['active']);
    const invoices: Invoice[] = [];

    for (const partner of partners.rows) {
      const month = new Date();
      month.setDate(1);

      const invoice = this.calculateInvoice(
        partner.partner_id,
        month,
        partner.monthly_revenue || 0
      );

      await this.saveInvoice(invoice);
      invoices.push(invoice);
    }

    console.log(`[RevenueSplitCalculator] Generated ${invoices.length} invoices`);
    return invoices;
  }

  async recordPayment(invoice_id: string, amount: number): Promise<void> {
    const query = `
      INSERT INTO partner_payments (invoice_id, payment_date, amount, status)
      VALUES ($1, NOW(), $2, 'completed')
    `;

    await this.db.query(query, [invoice_id, amount]);
    console.log(`[RevenueSplitCalculator] Payment recorded: ${invoice_id}`);
  }

  async getInvoiceHistory(partner_id: string): Promise<Invoice[]> {
    const query = `
      SELECT * FROM partner_invoices
      WHERE partner_id = $1
      ORDER BY month DESC
      LIMIT 12
    `;

    const result = await this.db.query(query, [partner_id]);
    return result.rows;
  }
}
