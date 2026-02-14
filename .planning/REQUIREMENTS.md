# Requirements: Home Warehouse System

**Defined:** 2026-02-14
**Core Value:** Reliable inventory access anywhere — online or offline — with seamless sync

## v1.8 Requirements

Requirements for Docker Deployment milestone. Each maps to roadmap phases.

### Compose Profiles

- [ ] **COMP-01**: Dev profile runs only Postgres + Redis with exposed ports for host development
- [ ] **COMP-02**: Prod profile runs full stack (Postgres, Redis, backend, worker, scheduler, frontend, Angie)
- [ ] **COMP-03**: Prod Postgres uses separate container and volume from dev with no exposed ports
- [ ] **COMP-04**: Docspell services moved to prod profile (not always-on)
- [ ] **COMP-05**: Migration runner executes before app services start in prod

### Container Images

- [ ] **IMG-01**: Backend image uses multi-stage build (Go builder + Alpine runtime with libwebp)
- [ ] **IMG-02**: Frontend image uses multi-stage build (bun builder + Node slim runner with standalone output)
- [ ] **IMG-03**: Worker has its own Dockerfile with only needed dependencies (no libwebp if not required)
- [ ] **IMG-04**: Scheduler has its own Dockerfile with only needed dependencies

### Reverse Proxy

- [ ] **PROXY-01**: Angie routes API requests to backend and all other requests to frontend
- [ ] **PROXY-02**: SSE connections proxied with buffering disabled and long timeouts
- [ ] **PROXY-03**: HTTPS with self-signed certs (cert generation script provided)
- [ ] **PROXY-04**: HTTP-to-HTTPS redirect

### Environment Configuration

- [ ] **ENV-01**: Prod environment variables set for production (NODE_ENV=production, no debug flags)
- [ ] **ENV-02**: Dev credentials not exposed in production containers
- [ ] **ENV-03**: Photo storage uses named Docker volume in prod

## Future Requirements

### Kubernetes

- **K8S-01**: Kubernetes manifests derived from compose setup
- **K8S-02**: Helm chart for parameterized deployment
- **K8S-03**: Ingress controller configuration

### CI/CD

- **CICD-01**: Automated image builds on push
- **CICD-02**: Container registry publishing
- **CICD-03**: Automated deployment pipeline

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kubernetes manifests | Future milestone — compose first |
| CI/CD pipeline | Separate concern, not part of compose setup |
| External/managed database | Both profiles use local Postgres containers |
| Let's Encrypt / ACME | Self-signed sufficient for initial deployment |
| Container registry publishing | Not needed for single-server compose |
| Docker Swarm | Going straight to k8s after compose |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | Phase 40 | Pending |
| COMP-02 | Phase 40 | Pending |
| COMP-03 | Phase 40 | Pending |
| COMP-04 | Phase 40 | Pending |
| COMP-05 | Phase 40 | Pending |
| ENV-01 | Phase 40 | Pending |
| ENV-02 | Phase 40 | Pending |
| ENV-03 | Phase 40 | Pending |
| IMG-01 | Phase 41 | Pending |
| IMG-02 | Phase 41 | Pending |
| IMG-03 | Phase 41 | Pending |
| IMG-04 | Phase 41 | Pending |
| PROXY-01 | Phase 42 | Pending |
| PROXY-02 | Phase 42 | Pending |
| PROXY-03 | Phase 42 | Pending |
| PROXY-04 | Phase 42 | Pending |

**Coverage:**
- v1.8 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after roadmap creation*
