#!/usr/bin/env bash
# Build app images locally and import them straight into the k3s node's
# containerd — no registry. Single-node only (image lives on one node).
#
# Deployments must use `imagePullPolicy: Never` and reference the same TAG.
#
# Each image is tagged twice: a mutable pointer (TAG, default "prod") that the
# Deployments reference, and an immutable git short-sha for rollback/audit.
# Both refs are imported into containerd in one `docker save`.
#
# Usage:
#   scripts/deploy-to-k3s.sh [backend|frontend|migrate|all] [TAG]
#
# Env overrides:
#   K3S_SSH      ssh target for the k3s node      (default: debian@192.168.10.10)
#   K3S_NS       containerd namespace             (default: k8s.io)
#   KUBECONFIG   kubeconfig for rollout restart   (default: ~/.kube/home-cluster)
#   NO_RESTART=1 skip `kubectl rollout restart` after import
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TARGET="${1:-all}"
TAG="${2:-prod}"
K3S_SSH="${K3S_SSH:-debian@192.168.10.10}"
K3S_NS="${K3S_NS:-k8s.io}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/home-cluster}"
NAMESPACE="warehouse"

# Immutable build id: git short sha, suffixed -dirty if the tree is unclean.
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null || GIT_SHA="${GIT_SHA}-dirty"

# image name -> "build context|dockerfile|deployment names (space-sep)|target"
# target empty = default final stage. deployments empty = no rollout (e.g. Job).
declare -A SPEC=(
  [warehouse-backend]="backend|backend/Dockerfile|backend worker scheduler|"
  [warehouse-frontend]="frontend|frontend/Dockerfile|frontend|"
  [warehouse-migrate]="backend|backend/Dockerfile||migrate"
)

build_and_import() {
  local image="$1"
  IFS='|' read -r ctx dockerfile deploys target <<<"${SPEC[$image]}"
  local ref="${image}:${TAG}"
  local sha_ref="${image}:${GIT_SHA}"

  local target_arg=()
  [[ -n "$target" ]] && target_arg=(--target "$target")

  echo "==> build ${ref} + ${sha_ref} (context: ${ctx}${target:+, target: $target})"
  docker buildx build --platform linux/amd64 --load --provenance=false \
    "${target_arg[@]}" -t "$ref" -t "$sha_ref" -f "$dockerfile" "$ctx"

  echo "==> import ${ref} + ${sha_ref} into ${K3S_SSH} containerd ns=${K3S_NS}"
  docker save "$ref" "$sha_ref" | ssh "$K3S_SSH" "sudo k3s ctr -n ${K3S_NS} images import -"

  if [[ "${NO_RESTART:-0}" != "1" ]]; then
    for d in $deploys; do
      echo "==> rollout restart deployment/${d}"
      KUBECONFIG="$KUBECONFIG" kubectl -n "$NAMESPACE" rollout restart "deployment/${d}" 2>/dev/null \
        || echo "    (deployment/${d} not found yet — skipping)"
    done
  fi
}

case "$TARGET" in
  backend)  build_and_import warehouse-backend ;;
  frontend) build_and_import warehouse-frontend ;;
  migrate)  build_and_import warehouse-migrate ;;
  all)      build_and_import warehouse-backend
            build_and_import warehouse-frontend
            build_and_import warehouse-migrate ;;
  *) echo "usage: $0 [backend|frontend|migrate|all] [TAG]" >&2; exit 1 ;;
esac

echo "==> done (tags: ${TAG} + ${GIT_SHA})"
