FILE #23: docs/DEPLOYMENT.md

# 🚀 Deployment Guide

## Quick Start (Docker)

```bash
docker-compose up -d


All services start automatically:

 • PostgreSQL 16 on port 5432
 • Redis 7 on port 6379
 • Neo4j 5 on ports 7474/7687
 • API on port 3000
 • Prometheus on port 9090
 • Grafana on port 3333

Verify Installation

curl http://localhost:3000/health
# Response: {"status": "healthy", ...}


Environment Setup

cp .env.example .env
# Edit .env with your values


Critical variables:

DATABASE_URL=postgresql://user:pass@host/db
REDIS_URL=redis://host:6379
NEO4J_URI=bolt://host:7687
WEBHOOK_SECRET=your-secret-key


Database Initialization

docker-compose exec postgres psql -U arven -d arven_evolution -f /schema.sql


Production Deployment

1. Build Image

docker build -t arven-evolution:3.0.0 .


2. Push to Registry

docker tag arven-evolution:3.0.0 your-registry/arven-evolution:3.0.0
docker push your-registry/arven-evolution:3.0.0


3. Deploy to Kubernetes

kubectl apply -f infrastructure/kubernetes/


4. Verify

kubectl get pods -n arven
kubectl logs -f deployment/arven-api -n arven


Scaling

Horizontal Scaling

kubectl scale deployment arven-api --replicas=3 -n arven


Database Connections

Adjust in .env:

DB_POOL_SIZE=50


Monitoring

 • Prometheus: http://localhost:9090
 • Grafana: http://localhost:3333 (admin/admin)
 • Logs: docker-compose logs -f arven-api

Health Checks

curl http://localhost:3000/health
curl http://localhost:3000/health/deep
curl http://localhost:3000/api/metrics


Backup

docker-compose exec postgres pg_dump -U arven arven_evolution > backup.sql


Restore

docker-compose exec postgres psql -U arven arven_evolution < backup.sql


Troubleshooting

Database connection error:

docker-compose logs postgres


API not responding:

docker-compose restart arven-api


Clear all data:

docker-compose down -v



