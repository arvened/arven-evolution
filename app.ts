import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';

dotenv.config();

interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  webhookUrl: string;
  webhookSecret: string;
}

const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost/arven_evolution',
  webhookUrl: process.env.REVIEWER_WEBHOOK_URL || 'http://localhost:3000/api/audit/webhook-callback',
  webhookSecret: process.env.WEBHOOK_SECRET || 'dev-secret-key',
};

const db = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
});

export class ArvenEvolutionApp {
  private app: express.Express;
  private eventBus: EventEmitter;

  constructor() {
    this.app = express();
    this.eventBus = new EventEmitter();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }));
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'arven-evolution-v3.0',
        timestamp: new Date(),
      });
    });

    this.app.get('/health/deep', async (req, res) => {
      try {
        await db.query('SELECT NOW()');
        res.json({ status: 'healthy', database: 'connected' });
      } catch (error: any) {
        res.status(503).json({ status: 'unhealthy', error: error.message });
      }
    });

    this.app.get('/api/metrics', (req, res) => {
      res.json({
        service: 'arven-evolution-v3.0',
        uptime_seconds: process.uptime(),
        timestamp: new Date(),
      });
    });
  }

  async start(): Promise<void> {
    try {
      await db.query('SELECT NOW()');
      console.log('✅ Database connected');

      this.app.listen(config.port, () => {
        console.log(`\n${'='.repeat(60)}`);
        console.log('🚀 ARVEN EVOLUTION v3.0 - PRODUCTION READY');
        console.log(`${'='.repeat(60)}`);
        console.log(`Port: ${config.port}`);
        console.log(`Environment: ${config.nodeEnv}`);
        console.log(`Database: ${config.databaseUrl}`);
        console.log(`${'='.repeat(60)}\n`);
      });
    } catch (error: any) {
      console.error('❌ Startup failed:', error.message);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await db.end();
    console.log('Database pool closed');
  }
}

const app = new ArvenEvolutionApp();
app.start();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down');
  await app.stop();
  process.exit(0);
});

export default app;
