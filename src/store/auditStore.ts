import type { AuditReport } from '../domain/types.ts';

export interface AuditStore {
  save(report: AuditReport): void;
  get(auditId: string): AuditReport | undefined;
  size(): number;
}

/**
 * In-memory store. Reports are lost on restart; the oldest report is evicted once the limit
 * is reached. A persistent store (for example PostgreSQL) can implement the same interface.
 */
export class InMemoryAuditStore implements AuditStore {
  private readonly reports = new Map<string, AuditReport>();
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  save(report: AuditReport): void {
    this.reports.delete(report.auditId);
    this.reports.set(report.auditId, report);
    while (this.reports.size > this.maxEntries) {
      const oldest = this.reports.keys().next().value;
      if (oldest === undefined) break;
      this.reports.delete(oldest);
    }
  }

  get(auditId: string): AuditReport | undefined {
    return this.reports.get(auditId);
  }

  size(): number {
    return this.reports.size;
  }
}
