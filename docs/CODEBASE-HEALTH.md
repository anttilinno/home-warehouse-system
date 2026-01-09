# Codebase Health Verification

This codebase is primarily AI-generated. While tests pass and features work, AI-generated code carries specific risks that require proactive monitoring. This document outlines how to identify hidden technical debt before it becomes costly.

## The AI Code Problem

AI-generated code tends to be *locally correct but globally incoherent*:
- Solves immediate problems but doesn't maintain consistent abstractions
- Slightly different patterns for the same problem across files
- Inconsistent error handling strategies
- Naming conventions that drift over time

This debt doesn't trigger metrics but makes the codebase progressively harder to reason about.

## 1. Code Complexity Metrics

### Cyclomatic Complexity

High complexity = harder to maintain and test.

```bash
# Python backend
cd backend && uv run radon cc src/ -a -s

# Show only complex functions (C grade or worse)
cd backend && uv run radon cc src/ -a -s --min C
```

**Thresholds:**
- A-B (1-10): Good
- C (11-20): Consider refactoring
- D-F (21+): Refactor immediately

### Maintainability Index

```bash
cd backend && uv run radon mi src/ -s
```

**Thresholds:**
- A (20+): Good
- B (10-19): Acceptable
- C (0-9): Needs attention

### Frontend Complexity

```bash
cd frontend && bunx eslint src/ --rule 'complexity: ["warn", 10]'
```

## 2. Test Quality (Not Just Coverage)

High coverage doesn't equal quality. AI-generated tests often mirror code rather than explore failure modes.

### Coverage Gaps

```bash
cd backend && uv run pytest --cov=src --cov-report=term-missing
```

Look for:
- Happy path only testing
- Missing edge cases (nulls, empty arrays, boundary values)
- No stress or concurrency tests

### Mutation Testing

The gold standard for test effectiveness. Introduces small bugs and checks if tests catch them.

```bash
# Python (requires mutmut)
cd backend && uv run mutmut run --paths-to-mutate=src/

# View surviving mutants (tests didn't catch these bugs)
cd backend && uv run mutmut results
```

**If many mutants survive, tests are covering lines but not actually verifying behavior.**

## 3. AI-Specific Code Smells

### Pattern Inconsistency

Check for multiple ways of doing the same thing:

```bash
# Find different error handling patterns
rg "raise HTTPException" backend/src/ | head -20
rg "raise.*Error" backend/src/ | head -20

# Find different response patterns
rg "return \{" backend/src/
rg "return Response" backend/src/

# Find different null checks
rg "if .* is None" backend/src/
rg "if not .*:" backend/src/
```

### Redundant Helpers

AI often creates similar helper functions. Look for:

```bash
# Functions with similar names
rg "^def (get_|fetch_|find_)" backend/src/
rg "^async def (get_|fetch_|find_)" backend/src/

# Utility functions that might be duplicated
rg "^def (format_|parse_|convert_)" backend/src/
```

### Copy-Paste Fragments

```bash
# Install and run duplicate detector
cd backend && uv run pylint src/ --disable=all --enable=duplicate-code
```

## 4. Architecture Health

### Dependency Analysis

```bash
# Python imports analysis
cd backend && uv run pydeps src/warehouse --cluster --max-bacon 2 -o deps.svg

# Check for circular imports
cd backend && uv run pydeps src/warehouse --show-cycles
```

### Layering Violations

The architecture should follow: Routes → Services → Repositories → Models

Check for violations:
```bash
# Routes importing repositories directly (skip services)
rg "from.*repository import" backend/src/warehouse/routes/

# Services importing route-specific things
rg "from.*routes import" backend/src/warehouse/services/
```

### Coupling Analysis

Track files changed together that shouldn't be coupled:

```bash
# Files frequently changed together in last 50 commits
git log --oneline -50 --name-only | grep -E "\.py$|\.tsx?$" | sort | uniq -c | sort -rn | head -20
```

## 5. Runtime Signals

Even if tests pass, runtime behavior reveals debt.

### Performance Profiling

```bash
# Profile endpoint response times
cd backend && uv run pytest e2e/ -v --durations=20

# Check for N+1 queries (look for repeated similar queries)
# Enable SQL logging in development and watch for patterns
```

### Memory and Resource Leaks

Monitor during extended test runs:
```bash
# Run tests with memory tracking
cd backend && uv run pytest --memray
```

## 6. Code Churn Analysis

Frequently changed files indicate unstable or poorly understood components:

```bash
# Most changed files in last 3 months
git log --since="3 months ago" --name-only --pretty=format: | \
  grep -E "\.(py|tsx?)$" | sort | uniq -c | sort -rn | head -20

# Files with most contributors (knowledge spread thin)
git shortlog -sn --all -- "backend/src/**/*.py" | head -10
```

**High churn + multiple contributors = likely debt hotspot.**

## 7. PR Scope Creep

Track how often PRs touch files outside stated scope:

```bash
# Large PRs often indicate coupling issues
git log --oneline --shortstat -50 | grep -E "files? changed" | \
  awk '{print $1}' | sort -rn | head -10
```

If "small fixes" regularly touch 10+ files, the architecture has hidden coupling.

## 8. Linting and Static Analysis

### Backend

```bash
cd backend && uv run ruff check src/ --statistics
cd backend && uv run mypy src/ --ignore-missing-imports
```

### Frontend

```bash
cd frontend && bun run lint
cd frontend && bunx tsc --noEmit
```

## 9. SonarQube Analysis

SonarQube provides comprehensive code quality analysis. Run locally with Docker:

### Start SonarQube

```bash
# Start SonarQube server
docker run -d --name sonarqube -p 9000:9000 sonarqube:community

# Wait for startup (check http://localhost:9000)
# Default credentials: admin/admin
```

### Analyze Backend

```bash
# Install sonar-scanner
cd backend

# Create sonar-project.properties
cat > sonar-project.properties << 'EOF'
sonar.projectKey=hws-backend
sonar.projectName=HWS Backend
sonar.sources=src
sonar.tests=e2e
sonar.python.version=3.14
sonar.python.coverage.reportPaths=coverage.xml
EOF

# Generate coverage report
uv run pytest --cov=src --cov-report=xml

# Run scanner (requires sonar-scanner installed or use Docker)
docker run --rm \
  --network host \
  -v "$(pwd):/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=YOUR_TOKEN
```

### Analyze Frontend

```bash
cd frontend

cat > sonar-project.properties << 'EOF'
sonar.projectKey=hws-frontend
sonar.projectName=HWS Frontend
sonar.sources=src
sonar.exclusions=node_modules/**,**/*.test.ts,**/*.test.tsx
sonar.typescript.lcov.reportPaths=coverage/lcov.info
EOF

docker run --rm \
  --network host \
  -v "$(pwd):/usr/src" \
  sonarsource/sonar-scanner-cli \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=YOUR_TOKEN
```

### SonarQube Metrics to Watch

- **Code Smells**: Maintainability issues
- **Bugs**: Potential runtime errors
- **Vulnerabilities**: Security issues
- **Duplications**: Copy-paste code percentage
- **Cognitive Complexity**: How hard code is to understand
- **Technical Debt Ratio**: Estimated remediation time vs development time

## 10. Security Scanning

```bash
# Python dependencies
cd backend && uv run pip-audit

# Check for hardcoded secrets
rg -i "(password|secret|key|token)\s*=" --type py --type ts

# SQL injection patterns
rg "f\".*SELECT|f\".*INSERT|f\".*UPDATE" backend/src/
```

## Health Check Checklist

Run periodically (weekly or before major releases):

| Check | Command | Target |
|-------|---------|--------|
| Complexity | `radon cc src/ -a` | Average < 10 |
| Coverage | `pytest --cov` | > 80% |
| Mutation score | `mutmut run` | > 70% killed |
| Duplicate code | `pylint --enable=duplicate-code` | 0 issues |
| Type coverage | `mypy src/` | 0 errors |
| Security | `pip-audit` | 0 vulnerabilities |
| Lint | `ruff check` | 0 errors |
| SonarQube | Quality Gate | Passed |

## Prioritizing Debt

Not all debt is equal. Prioritize by:

1. **Blast radius**: How much breaks if this fails?
   - Core auth, data layer = high priority
   - Edge features = lower priority

2. **Velocity**: How often does this change?
   - High churn + high complexity = urgent
   - Stable complex code = monitor but lower priority

3. **Team pain**: Are developers frequently confused here?
   - Track questions in code reviews and discussions

## Recommended Workflow

1. **Weekly**: Run lint, type check, security scan
2. **Per PR**: Check complexity of changed files
3. **Monthly**: Full mutation testing, SonarQube analysis, architecture review
4. **Quarterly**: Debt audit, update this document

## Tools Summary

| Purpose | Python | TypeScript |
|---------|--------|------------|
| Complexity | radon | eslint complexity rule |
| Duplication | pylint | jscpd |
| Type checking | mypy | tsc |
| Mutation testing | mutmut | stryker |
| Security | pip-audit, bandit | npm audit |
| Dependencies | pydeps | madge |
| Comprehensive | SonarQube | SonarQube |
