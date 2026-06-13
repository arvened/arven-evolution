#!/bin/bash

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-3.0.0}

echo "🚀 ARVEN EVOLUTION - Deploy to $ENVIRONMENT"
echo "==========================================="

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: ./scripts/deploy.sh [staging|production] [version]"
    exit 1
fi

# Load environment
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo "❌ .env.$ENVIRONMENT not found"
    exit 1
fi

echo "📝 Loading $ENVIRONMENT environment..."
export $(cat ".env.$ENVIRONMENT" | xargs)

# Build
echo "🔨 Building..."
npm run build

# Docker build
echo "🐳 Building Docker image..."
docker build -t arven-evolution:$VERSION .

# Push to registry
if [ ! -z "$DOCKER_REGISTRY" ]; then
    echo "📤 Pushing to registry..."
    docker tag arven-evolution:$VERSION $DOCKER_REGISTRY/arven-evolution:$VERSION
    docker push $DOCKER_REGISTRY/arven-evolution:$VERSION
fi

# Deploy
if [ "$ENVIRONMENT" = "staging" ]; then
    echo "📍 Deploying to staging..."
    docker-compose -f docker-compose.staging.yml up -d
elif [ "$ENVIRONMENT" = "production" ]; then
    echo "🌍 Deploying to production..."
    kubectl set image deployment/arven-api arven-api=$DOCKER_REGISTRY/arven-evolution:$VERSION -n arven
    kubectl rollout status deployment/arven-api -n arven
fi

# Health check
echo "🏥 Health check..."
sleep 10
curl http://localhost:3000/health || curl https://$DEPLOY_HOST/health

echo ""
echo "✅ Deployment complete!"
echo "Version: $VERSION"
echo "Environment: $ENVIRONMENT"
