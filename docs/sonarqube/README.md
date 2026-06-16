# SonarQube Code Analysis

Static analysis of the two project subtrees, run **separately**, against an
ephemeral local SonarQube **Community v26.6** server.

- Generated: **2026-06-16**
- Server: ephemeral `sonarqube:community` docker container (torn down after export)
- Quality profiles: SonarQube built-in defaults (Sonar way)
- Coverage: **not imported** — both projects show 0%; these were source-only
  scans (no LCOV / Go coverage report fed in)

## Reports

| Report | Project key | Sources | Issues | Hotspots |
|--------|-------------|---------|--------|----------|
| [FRONTEND.md](FRONTEND.md) | `hw-frontend` | `frontend/src` (TS/TSX) | 320 | 3 |
| [BACKEND.md](BACKEND.md)  | `hw-backend`  | `backend/` (Go) | 301 | 2 |

Raw API responses (measures / issues / hotspots JSON) are in [`raw/`](raw/).

## Headline

**Frontend** — Quality gate OK. 15 bugs, 0 vulnerabilities, 305 code smells
(0 BLOCKER / 3 CRITICAL). Tech debt ~27h. Reliability B, Security A,
Security-Review E, Maintainability A. Top rule `S6759` (read-only props, 127×).
3 hotspots: 2 ReDoS regex (S5852), 1 insecure PRNG (S2245).

**Backend** — Quality gate OK. 1 bug, 0 vulnerabilities, 300 code smells
(0 BLOCKER / 203 CRITICAL, mostly `go:S1192` duplicated literals + `go:S3776`
cognitive complexity). Tech debt ~80h. Reliability C, Security A,
Security-Review E, Maintainability A. 2 hotspots: Dockerfile recursive COPY
(S6470) + root user (S6471).

> Security-Review rating E on both is driven solely by un-triaged hotspots
> (TO_REVIEW state), not by confirmed vulnerabilities (Security rating is A on
> both). Triage the hotspots to clear it.

## Reproduce

No scanner/server is installed permanently. To re-run:

```sh
# 1. start ephemeral server
docker run -d --name hw-sonar -p 9000:9000 \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true sonarqube:community
# wait until: curl -s localhost:9000/api/system/status  => "status":"UP"

# 2. provision (default admin/admin -> change, then generate analysis token)
curl -s -u admin:admin -X POST localhost:9000/api/users/change_password \
  --data-urlencode login=admin --data-urlencode previousPassword=admin \
  --data-urlencode password=<NEWPASS>
TOK=$(curl -s -u admin:<NEWPASS> -X POST \
  "localhost:9000/api/user_tokens/generate?name=scan&type=GLOBAL_ANALYSIS_TOKEN" \
  | jq -r .token)

# 3. scan frontend
docker run --rm --network host -e SONAR_HOST_URL=http://localhost:9000 \
  -e SONAR_TOKEN=$TOK -v "$PWD/frontend:/usr/src" sonarsource/sonar-scanner-cli \
  -Dsonar.projectKey=hw-frontend -Dsonar.sources=src \
  -Dsonar.exclusions='**/node_modules/**,**/dist/**,**/*.test.ts,**/*.test.tsx,**/e2e/**,**/locales/**,**/*.d.ts'

# 4. scan backend (Go)
docker run --rm --network host -e SONAR_HOST_URL=http://localhost:9000 \
  -e SONAR_TOKEN=$TOK -v "$PWD/backend:/usr/src" sonarsource/sonar-scanner-cli \
  -Dsonar.projectKey=hw-backend -Dsonar.sources=. \
  -Dsonar.exclusions='**/vendor/**,**/*_test.go,**/*.sql.go,**/mocks/**,**/testdb/**,**/testfixtures/**'

# 5. teardown
docker rm -f hw-sonar
```

To make the Security-Review rating meaningful and get real coverage numbers,
import `frontend/coverage/lcov.info` (Vitest) and a Go `coverage.out`
(`go test -coverprofile`) via `sonar.javascript.lcov.reportPaths` /
`sonar.go.coverage.reportPaths` on the next run.
