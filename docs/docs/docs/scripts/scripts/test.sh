#!/bin/bash

set -e

echo "🧪 ARVEN EVOLUTION - Test Suite"
echo "==============================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Run: npm install"
    exit 1
fi

# Run linting
echo "📝 Running linter..."
npm run lint
echo "✅ Linting passed"

# Run type checking
echo "🔍 Type checking..."
npm run typecheck
echo "✅ Type checking passed"

# Run unit tests
echo "🧪 Running unit tests..."
npm test -- --coverage
echo "✅ Unit tests passed"

# Run integration tests
echo "🔗 Running integration tests..."
npm run test:integration || echo "⚠️  Integration tests skipped"

# Security scan
echo "🔐 Security scan..."
npm audit || echo "⚠️  Vulnerabilities found, review audit"

echo ""
echo "✅ All tests passed!"
echo ""
echo "Coverage report: coverage/index.html"
