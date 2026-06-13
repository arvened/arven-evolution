

# Contributing to ARVEN EVOLUTION

Thank you for your interest in contributing!

## Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/arven-evolution.git
cd arven-evolution


2. Setup

npm install
npm run build
cp config/.env.example .env
docker-compose up -d


3. Create Branch

git checkout -b feature/your-feature-name


Development Guidelines

Code Style

 • Language: TypeScript (100% type safety)
 • Formatter: Prettier
 • Linter: ESLint
 • Package Manager: pnpm

Before Submitting

npm run lint          # Check code quality
npm run format        # Auto-format code
npm run typecheck     # Check TypeScript types
npm test              # Run all tests


Commit Messages

feat: add new security pattern
fix: resolve webhook retry issue
docs: update API documentation
test: add unit tests for scorer
refactor: simplify audit pipeline
chore: update dependencies


Pull Request Process

 1. Update tests if changing logic
 2. Add docs for new features
 3. Write clear PR description
 4. Link to related issues
 5. Request review from maintainers

Architecture Rules

1. 9-Level Pipeline

Don’t break the pipeline:

 • L1: Orchestration
 • L2: Coordinator
 • L3: Architect
 • L4: Developer
 • L5: Performance
 • L6: Security Module (PARALLEL)
 • L7: Reviewer (INTEGRATED VERDICT)
 • L8: Partner Revenue
 • L9: Reporting

2. Type Safety

 • ❌ No any types
 • ✅ Export all interfaces
 • ✅ Use discriminated unions
 • ✅ Validate at boundaries

3. Error Handling

try {
  await operation();
} catch (error) {
  if (error instanceof CustomError) {
    // Handle
  }
  throw new ApplicationError('context', error);
}


4. Database Queries

 • Use typed queries
 • Include indexes for WHERE clauses
 • Use connection pooling
 • Write migrations for schema changes

5. Testing

Every module needs tests:

tests/
├── scorer.test.ts
├── api.test.ts
├── webhook.test.ts
└── integration.test.ts


6. Documentation

 • Add JSDoc comments for public APIs
 • Update ARCHITECTURE.md if changing design
 • Add examples in README
 • Document breaking changes

Areas We Need Help With

High Priority:

 • Unit tests (Jest)
 • Integration tests
 • Load testing (1000+ concurrent)
 • Kubernetes configs

Medium Priority:

 • API client libraries
 • Web dashboard UI
 • Analytics improvements
 • Performance optimization

Low Priority:

 • Documentation translations
 • Community examples
 • Blog posts
 • Tutorials

Review Process

 1. Automated checks run (lint, test, typecheck)
 2. Code review by maintainers (2-3 days)
 3. Discussion on any changes needed
 4. Approval when ready
 5. Merge to main branch

Questions?

 • Issues: Create a GitHub issue
 • Discussions: Use GitHub Discussions
 • Email: hello@arvend.io

Licensing

By contributing, you agree your code is licensed under MIT License.


