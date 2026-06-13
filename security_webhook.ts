import axios, { AxiosError } from 'axios';

export interface WebhookRetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  timeout_ms: number;
}

export interface WebhookEvent {
  event_id: string;
  audit_id: string;
  attempt: number;
  timestamp: Date;
  status: 'sent' | 'failed' | 'retrying' | 'abandoned';
  error?: string;
  response_code?: number;
}

export class WebhookCallbackHandler {
  private webhookUrl: string;
  private webhookSecret: string;
  private retryManager: WebhookRetryManager;
  private logger: WebhookLogger;

  constructor(
    webhookUrl: string,
    webhookSecret: string,
    retryConfig?: Partial<WebhookRetryConfig>
  ) {
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret;
    this.retryManager = new WebhookRetryManager(retryConfig);
    this.logger = new WebhookLogger();
  }

  async sendCallback(payload: any): Promise<WebhookEvent> {
    const event_id = evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)};
    const audit_id = payload.audit_id;

    console.log(`[Webhook] Sending callback: ${event_id} for audit ${audit_id}`);

    return this.retryManager.executeWithRetry(
      async (attempt) => {
        const event = await this.sendRequest(payload, event_id, audit_id, attempt);
        this.logger.logEvent(event);
        return event;
      },
      audit_id
    );
  }

  private async sendRequest(
    payload: any,
    event_id: string,
    audit_id: string,
    attempt: number
  ): Promise<WebhookEvent> {
    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Authorization': Bearer ${this.webhookSecret},
          'Content-Type': 'application/json',
          'X-Webhook-ID': event_id,
          'X-Attempt': attempt.toString(),
        },
        timeout: 30000,
      });

      console.log(`[Webhook] Success: ${event_id} (${response.status})`);

      return {
        event_id,
        audit_id,
        attempt,
        timestamp: new Date(),
        status: 'sent',
        response_code: response.status,
      };
    } catch (error: any) {
      const axiosError = error as AxiosError;
      console.error(`[Webhook] Error: ${event_id} - ${axiosError.message}`);

      throw {
        event_id,
        audit_id,
        attempt,
        timestamp: new Date(),
        status: 'failed',
        error: axiosError.message,
        response_code: axiosError.response?.status,
      };
    }
  }
}

export class WebhookRetryManager {
  private config: WebhookRetryConfig;

  constructor(config?: Partial<WebhookRetryConfig>) {
    this.config = {
      max_retries: config?.max_retries || 3,
      initial_delay_ms: config?.initial_delay_ms || 1000,
      max_delay_ms: config?.max_delay_ms || 30000,
      backoff_multiplier: config?.backoff_multiplier || 2,
      timeout_ms: config?.timeout_ms || 30000,
    };
  }

  async executeWithRetry(
    fn: (attempt: number) => Promise<WebhookEvent>,
    audit_id: string
  ): Promise<WebhookEvent> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= this.config.max_retries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.max_retries) {
          const delayMs = Math.min(
            this.config.initial_delay_ms * Math.pow(this.config.backoff_multiplier, attempt - 1),
            this.config.max_delay_ms
          );

          console.log(`[WebhookRetry] Retrying ${audit_id} in ${delayMs}ms (attempt ${attempt}/${this.config.max_retries})`);
          await this.sleep(delayMs);
        }
      }
    }

    console.error(`[WebhookRetry] Abandoned after ${this.config.max_retries} attempts: ${audit_id}`);
    return {
      ...lastError,
      status: 'abandoned',
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class WebhookLogger {
  private events: Map<string, WebhookEvent> = new Map();

logEvent(event: WebhookEvent): void {
    this.events.set(event.event_id, event);

    const status_emoji = {
      'sent': '✅',
      'failed': '❌',
      'retrying': '⏳',
      'abandoned': '🚫',
    }[event.status] || '❓';

    console.log(
      ${status_emoji} [${event.timestamp.toISOString()}] ${event.event_id} - ${event.audit_id} (attempt ${event.attempt})
    );
  }

  getEventHistory(limit: number = 100): WebhookEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getEventStats(): any {
    const events = Array.from(this.events.values());
    return {
      total: events.length,
      sent: events.filter(e => e.status === 'sent').length,
      failed: events.filter(e => e.status === 'failed').length,
      abandoned: events.filter(e => e.status === 'abandoned').length,
    };
  }
}
