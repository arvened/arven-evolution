#!/bin/bash

set -e

echo "🚀 ARVEN EVOLUTION v3.0 - Local Setup"
echo "======================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker"
    exit 1
fi

echo "✅ Docker installed"

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example"
    cp .env.example .env
    echo "⚠️  Edit .env with your values"
else
    echo "✅ .env exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for database
echo "⏳ Waiting for database..."
sleep 5

# Run migrations
echo "🗄️  Initializing database..."
docker-compose exec -T postgres psql -U arven -d arven_evolution -f schema.sql 2>/dev/null || true

# Health check
echo "🏥 Health check..."
curl http://localhost:3000/health || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "Services running:"
echo "  API:        http://localhost:3000"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana:    http://localhost:3333"
echo "  Neo4j:      http://localhost:7474"
echo ""
echo "Start development: npm run dev"
