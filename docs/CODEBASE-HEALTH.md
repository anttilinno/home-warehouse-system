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
# Go backend - install gocyclo
go install github.com/fzipp/gocyclo/cmd/gocyclo@latest

# Show all functions with complexity > 10
cd backend && gocyclo -over 10 .

# Show top 20 most complex functions
cd backend && gocyclo -top 20 .
```

**Thresholds:**
- 1-10: Good
- 11-20: Consider refactoring
- 21+: Refactor immediately

### Cognitive Complexity

```bash
# Install gocognit
go install github.com/uudashr/gocognit/cmd/gocognit@latest

# Show functions with cognitive complexity > 15
cd backend && gocognit -over 15 .
```

### Frontend Complexity

```bash
cd frontend && bunx eslint src/ --rule 'complexity: ["warn", 10]'
```

## 2. Test Quality (Not Just Coverage)

High coverage doesn't equal quality. AI-generated tests often mirror code rather than explore failure modes.

### Coverage Gaps

```bash
# Go backend
cd backend && go test ./... -coverprofile=coverage.out
cd backend && go tool cover -func=coverage.out | grep -v "100.0%"

# HTML coverage report
cd backend && go tool cover -html=coverage.out -o coverage.html
```

Look for:
- Happy path only testing
- Missing edge cases (nulls, empty slices, boundary values)
- No stress or concurrency tests

### Mutation Testing

The gold standard for test effectiveness. Introduces small bugs and checks if tests catch them.

```bash
# Go (requires gremlins)
go install github.com/go-gremlins/gremlins/cmd/gremlins@latest

cd backend && gremlins unleash

# Alternative: ooze
go install github.com/gtramontina/ooze/cmd/ooze@latest
cd backend && ooze
```

**If many mutants survive, tests are covering lines but not actually verifying behavior.**

## 3. AI-Specific Code Smells

### Pattern Inconsistency

Check for multiple ways of doing the same thing:

```bash
# Find different error handling patterns
rg "huma\.Error" backend/internal/ | head -20
rg "errors\.New|fmt\.Errorf" backend/internal/ | head -20

# Find different response patterns
rg "return \&.*Output" backend/internal/
rg "return nil, huma\." backend/internal/

# Find different nil checks
rg "if .* == nil" backend/internal/ | head -20
rg "if .* != nil" backend/internal/ | head -20
```

### Redundant Helpers

AI often creates similar helper functions. Look for:

```bash
# Functions with similar names
rg "^func.*(Get|Fetch|Find)" backend/internal/
rg "^func.*(Create|New|Make)" backend/internal/

# Utility functions that might be duplicated
rg "^func.*(Format|Parse|Convert)" backend/internal/
```

### Copy-Paste Fragments

```bash
# Install and run duplicate detector
go install github.com/mibk/dupl@latest
cd backend && dupl -t 100 .

# Alternative: use golangci-lint with dupl enabled
cd backend && golangci-lint run --enable dupl
```

## 4. Architecture Health

### Dependency Analysis

```bash
# Go dependency graph
go install github.com/loov/goda@latest
cd backend && goda graph ./... | dot -Tsvg -o deps.svg

# Check for circular dependencies
cd backend && goda graph -cluster ./... 2>&1 | grep -i cycle

# Analyze package dependencies
cd backend && go mod graph | head -50
```

### Layering Violations

The architecture should follow: Handlers → Services → Repositories → Entities

Check for violations:
```bash
# Handlers importing repositories directly (skip services)
rg "infra/postgres" backend/internal/domain/*/handler.go

# Services importing handler-specific things
rg "api/middleware" backend/internal/domain/*/service.go

# Domain importing infrastructure
rg "infra/" backend/internal/domain/ --type go | grep -v "_test.go"
```

### Coupling Analysis

Track files changed together that shouldn't be coupled:

```bash
# Files frequently changed together in last 50 commits
git log --oneline -50 --name-only | grep -E "\.go$|\.tsx?$" | sort | uniq -c | sort -rn | head -20
```

## 5. Runtime Signals

Even if tests pass, runtime behavior reveals debt.

### Performance Profiling

```bash
# Profile test execution times
cd backend && go test ./... -v 2>&1 | grep -E "^\s+--- (PASS|FAIL):" | sort -t'(' -k2 -rn | head -20

# Benchmark tests
cd backend && go test ./... -bench=. -benchmem

# CPU profiling
cd backend && go test ./... -cpuprofile=cpu.out
go tool pprof cpu.out
```

### Memory and Resource Leaks

Monitor during extended test runs:
```bash
# Memory profiling
cd backend && go test ./... -memprofile=mem.out
go tool pprof mem.out

# Race condition detection
cd backend && go test ./... -race
```

## 6. Code Churn Analysis

Frequently changed files indicate unstable or poorly understood components:

```bash
# Most changed files in last 3 months
git log --since="3 months ago" --name-only --pretty=format: | \
  grep -E "\.(go|tsx?)$" | sort | uniq -c | sort -rn | head -20

# Files with most contributors (knowledge spread thin)
git shortlog -sn --all -- "backend/**/*.go" | head -10
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
# Comprehensive linting with golangci-lint
cd backend && golangci-lint run ./...

# With specific linters enabled
cd backend && golangci-lint run --enable-all --disable exhaustruct,depguard ./...

# Go vet (built-in)
cd backend && go vet ./...

# Static analysis
go install honnef.co/go/tools/cmd/staticcheck@latest
cd backend && staticcheck ./...
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
cd backend

# Create sonar-project.properties
cat > sonar-project.properties << 'EOF'
sonar.projectKey=hws-backend
sonar.projectName=HWS Backend
sonar.sources=.
sonar.exclusions=**/*_test.go,**/testutil/**,**/tests/**
sonar.tests=.
sonar.test.inclusions=**/*_test.go
sonar.go.coverage.reportPaths=coverage.out
EOF

# Generate coverage report
go test ./... -coverprofile=coverage.out

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

### govulncheck Setup

govulncheck requires the Go version in your toolchain to match what your project needs. If you see errors like:
```
package requires newer Go version go1.24 (application built with go1.23)
```

Fix by ensuring mise.toml matches go.mod:
```bash
# Check what go.mod requires
head -3 backend/go.mod
# go 1.24.0
# toolchain go1.24.11

# Update mise.toml to match
# [tools]
# go = "1.24"  # Must match go.mod

# Install the correct Go version
mise install go@1.24
```

### Running govulncheck

```bash
# Go dependencies vulnerability check (run from backend/)
cd backend && go run golang.org/x/vuln/cmd/govulncheck@latest ./...

# Check for hardcoded secrets
rg -i "(password|secret|key|token)\s*=" --type go --type ts

# SQL injection patterns (should use parameterized queries)
rg "fmt\.Sprintf.*SELECT|fmt\.Sprintf.*INSERT|fmt\.Sprintf.*UPDATE" backend/

# Security linter
go install github.com/securego/gosec/v2/cmd/gosec@latest
cd backend && gosec ./...
```

## Health Check Checklist

Run periodically (weekly or before major releases):

| Check | Command | Target |
|-------|---------|--------|
| Complexity | `gocyclo -top 20 .` | No function > 15 |
| Coverage | `go test ./... -cover` | > 80% |
| Mutation score | `gremlins unleash` | > 70% killed |
| Duplicate code | `dupl -t 100 .` | 0 issues |
| Race conditions | `go test ./... -race` | 0 races |
| Security | `govulncheck ./...` | 0 vulnerabilities |
| Lint | `golangci-lint run` | 0 errors |
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

| Purpose | Go | TypeScript |
|---------|-----|------------|
| Complexity | gocyclo, gocognit | eslint complexity rule |
| Duplication | dupl, golangci-lint | jscpd |
| Static analysis | go vet, staticcheck | tsc |
| Mutation testing | gremlins, ooze | stryker |
| Security | govulncheck, gosec | npm audit |
| Dependencies | goda, go mod graph | madge |
| Race detection | go test -race | - |
| Comprehensive | SonarQube, golangci-lint | SonarQube |
